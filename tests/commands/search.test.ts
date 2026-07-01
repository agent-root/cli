import { describe, expect, it, vi, beforeEach } from 'vitest';
import { clampLimit, clampPage, recordToSearchResult, matchKind, semanticHitToSearchResult, searchSemantic, searchWithFallback, displayResults, cmdSearch, type SemanticSearchHit, type SemanticSearchResponse } from '../../src/commands/search';

const stripAnsi = (s: string): string => s.replace(/\[[0-9;]*m/g, '');
import { fetchJSON } from '../../src/services/http/fetch';

// Mock the HTTP layer so searchSemantic tests don't hit the network. Preserve
// the module's other exports (fetch, postJSON) via importActual so unrelated
// importers don't break.
vi.mock('../../src/services/http/fetch', async (importActual) => {
  const actual = await importActual<typeof import('../../src/services/http/fetch')>();
  return { ...actual, fetchJSON: vi.fn() };
});

const mockFetchJSON = vi.mocked(fetchJSON);

const semHit = (over: Partial<SemanticSearchHit> = {}): SemanticSearchHit => ({
  id: 1,
  record_id: 'usdc-checkout',
  domain: 'doma.xyz',
  type: 'skill',
  name: 'USDC Checkout',
  description: 'Accept USDC payments via Coinbase Commerce',
  manifest_url: null,
  rrf_score: 0.0325,
  bm25_rank: 1,
  vector_rank: 2,
  ...over,
});

describe('clampLimit', () => {
  it('returns the default for undefined input', () => {
    expect(clampLimit(undefined)).toBe(20);
  });

  it('returns the default for non-numeric strings', () => {
    expect(clampLimit('not-a-number')).toBe(20);
  });

  it('coerces a numeric string into a number', () => {
    expect(clampLimit('15')).toBe(15);
  });

  it('clamps below 1 to the default (1 floor)', () => {
    expect(clampLimit(0)).toBe(20);
    expect(clampLimit(-5)).toBe(20);
  });

  it('caps values above 100 at the API maximum', () => {
    expect(clampLimit(500)).toBe(100);
    expect(clampLimit('1000')).toBe(100);
  });

  it('floors non-integer values rather than rounding', () => {
    expect(clampLimit(42.9)).toBe(42);
  });

  it('accepts numbers in the valid range unchanged', () => {
    expect(clampLimit(50)).toBe(50);
    expect(clampLimit(100)).toBe(100);
  });
});

describe('clampPage', () => {
  it('defaults to 1 for undefined input', () => {
    expect(clampPage(undefined)).toBe(1);
  });

  it('defaults to 1 for non-numeric strings', () => {
    expect(clampPage('asdf')).toBe(1);
  });

  it('coerces numeric strings', () => {
    expect(clampPage('7')).toBe(7);
  });

  it('floors values below 1 to 1', () => {
    expect(clampPage(0)).toBe(1);
    expect(clampPage(-3)).toBe(1);
  });

  it('floors non-integer values', () => {
    expect(clampPage(3.8)).toBe(3);
  });

  it('accepts large valid page numbers', () => {
    expect(clampPage(143)).toBe(143);
  });
});

describe('recordToSearchResult', () => {
  it('maps the canonical /api/records row shape onto SearchResult', () => {
    const row = {
      id: 17, manifest_id: 6,
      domain: 'doma.xyz', record_id: 'doma-protocol',
      type: 'skill', name: 'Doma Protocol', description: 'Trade tokens, ...',
      endpoint: null,
      raw_record: { skill_md: 'https://doma.xyz/.agents/skills/doma-protocol/SKILL.md' },
      auth: null, status: 'active',
      manifest_domain: 'doma.xyz', manifest_status: 'active',
    };
    const r = recordToSearchResult(row);
    expect(r.domain).toBe('doma.xyz');
    expect(r.type).toBe('skill');
    expect(r.id).toBe('doma-protocol');
    expect(r.record_id).toBe('doma-protocol');
    expect(r.name).toBe('Doma Protocol');
    expect(r.address).toBe('doma.xyz/doma-protocol');
    expect(r.verified).toBe(true);
    expect(r.skill_md).toBe('https://doma.xyz/.agents/skills/doma-protocol/SKILL.md');
  });

  it('marks results unverified when manifest_status is not active', () => {
    const r = recordToSearchResult({
      domain: 'foo.io', record_id: 'x', type: 'skill', name: 'X',
      status: 'active', manifest_status: 'pending',
    });
    expect(r.verified).toBe(false);
  });

  it('falls back to record_id when name is missing', () => {
    const r = recordToSearchResult({ domain: 'foo.io', record_id: 'rec-1', type: 'agent' });
    expect(r.name).toBe('rec-1');
  });

  it('normalizes capabilities from a JSON array', () => {
    const r = recordToSearchResult({
      domain: 'foo.io', record_id: 'x', type: 'mcp',
      capabilities: ['cap-a', 'cap-b'],
    });
    expect(r.capabilities).toEqual(['cap-a', 'cap-b']);
  });

  it('normalizes capabilities from a comma-separated string', () => {
    const r = recordToSearchResult({
      domain: 'foo.io', record_id: 'x', type: 'mcp',
      capabilities: 'cap-a, cap-b, cap-c',
    });
    expect(r.capabilities).toEqual(['cap-a', 'cap-b', 'cap-c']);
  });

  it('uses raw_record.endpoint when the top-level endpoint is null', () => {
    const r = recordToSearchResult({
      domain: 'foo.io', record_id: 'mcp1', type: 'mcp',
      endpoint: null, raw_record: { endpoint: 'https://foo.io/mcp' },
    });
    expect(r.endpoint).toBe('https://foo.io/mcp');
  });

  it('defaults type to skill when missing (legacy rows)', () => {
    const r = recordToSearchResult({ domain: 'foo.io', record_id: 'x' });
    expect(r.type).toBe('skill');
  });
});

describe('matchKind', () => {
  it('returns hybrid when both bm25 and vector ranks are present', () => {
    expect(matchKind(semHit())).toBe('hybrid');
  });

  it('returns vector when only vector_rank is present', () => {
    expect(matchKind(semHit({ bm25_rank: null }))).toBe('vector');
  });

  it('returns keyword when only bm25_rank is present (degraded / BM25-only)', () => {
    expect(matchKind(semHit({ vector_rank: null }))).toBe('keyword');
  });
});

describe('semanticHitToSearchResult', () => {
  it('maps a hit to an approximate SearchResult with address + match tag', () => {
    const r = semanticHitToSearchResult(semHit());
    expect(r.domain).toBe('doma.xyz');
    expect(r.type).toBe('skill');
    expect(r.id).toBe('usdc-checkout');
    expect(r.record_id).toBe('usdc-checkout');
    expect(r.name).toBe('USDC Checkout');
    expect(r.address).toBe('doma.xyz/usdc-checkout');
    expect(r.verified).toBe(true);
    expect(r.approximate).toBe(true);
    expect(r.match).toBe('hybrid');
  });

  it('falls back to record_id when name is null', () => {
    expect(semanticHitToSearchResult(semHit({ name: null })).name).toBe('usdc-checkout');
  });
});

describe('searchSemantic', () => {
  beforeEach(() => mockFetchJSON.mockReset());

  const resp = (over: Partial<SemanticSearchResponse> = {}): SemanticSearchResponse => ({
    query: 'usdc', type_filter: null, total: 0, degraded: false, results: [], ...over,
  });

  it('maps a 200 response to approximate, match-tagged results', async () => {
    mockFetchJSON.mockResolvedValueOnce(resp({ total: 1, results: [semHit()] }));
    const out = await searchSemantic('usdc', '', {});
    expect(out).toHaveLength(1);
    expect(out[0]?.approximate).toBe(true);
    expect(out[0]?.match).toBe('hybrid');
    expect(out[0]?.address).toBe('doma.xyz/usdc-checkout');
  });

  it('returns [] on a 429 (fetchJSON throws "HTTP 429 …")', async () => {
    mockFetchJSON.mockRejectedValueOnce(new Error('HTTP 429 for https://www.agentroot.io/api/search?q=usdc'));
    await expect(searchSemantic('usdc', '', {})).resolves.toEqual([]);
  });

  it('returns [] on network/5xx/timeout errors', async () => {
    mockFetchJSON.mockRejectedValueOnce(new Error('Timeout after 30000ms fetching ...'));
    await expect(searchSemantic('usdc', '', {})).resolves.toEqual([]);
  });

  it('returns [] when results is missing or not an array', async () => {
    mockFetchJSON.mockResolvedValueOnce({ query: 'x', type_filter: null, total: 0, degraded: false } as unknown as SemanticSearchResponse);
    await expect(searchSemantic('x', '', {})).resolves.toEqual([]);
  });

  it('forwards --type and caps limit at 50', async () => {
    mockFetchJSON.mockResolvedValueOnce(resp({ type_filter: 'skill' }));
    await searchSemantic('usdc', 'skill', { limit: '500' });
    const url = String(mockFetchJSON.mock.calls[0]?.[0]);
    expect(url).toContain('/api/search?');
    expect(url).toContain('type=skill');
    expect(url).toContain('limit=50');
  });
});

describe('searchWithFallback ordering', () => {
  beforeEach(() => mockFetchJSON.mockReset());

  function routeByUrl(map: { records?: unknown; search?: unknown; findSkills?: unknown }): void {
    mockFetchJSON.mockImplementation(((url?: string) => {
      const u = String(url ?? '');
      if (u.includes('/api/records')) return Promise.resolve(map.records ?? { records: [] });
      if (u.includes('/api/search')) return Promise.resolve(map.search ?? { results: [] });
      if (u.includes('/api/find-skills')) return Promise.resolve(map.findSkills ?? { skills: [] });
      // Manifest-probe + anything else: benign empty manifest (no records).
      return Promise.resolve({ records: [] });
    }) as typeof fetchJSON);
  }

  const calledSearch = (): boolean =>
    mockFetchJSON.mock.calls.some(c => String(c[0]).includes('/api/search'));

  it('does NOT call /api/search when /api/records has hits', async () => {
    routeByUrl({ records: { records: [{ domain: 'a.io', record_id: 'r', type: 'mcp', name: 'R', status: 'active', manifest_status: 'active' }], total: 1, page: 1, pages: 1 } });
    const out = await searchWithFallback('r', '', {});
    expect(out).toHaveLength(1);
    expect(out[0]?.approximate).toBeUndefined();
    expect(calledSearch()).toBe(false);
  });

  it('falls back to /api/search and returns approximate hits when records is empty', async () => {
    routeByUrl({ records: { records: [], total: 0, page: 1, pages: 0 }, search: { query: 'usdc', type_filter: null, total: 1, degraded: false, results: [semHit()] } });
    const out = await searchWithFallback('usdc', '', {});
    expect(out).toHaveLength(1);
    expect(out[0]?.approximate).toBe(true);
    expect(out[0]?.match).toBe('hybrid');
    expect(calledSearch()).toBe(true);
  });

  it('skips the semantic tier when noSemantic is set', async () => {
    routeByUrl({ records: { records: [], total: 0, page: 1, pages: 0 } });
    await searchWithFallback('usdc', '', { noSemantic: true });
    expect(calledSearch()).toBe(false);
  });
});

describe('displayResults approximate framing', () => {
  it('prints a closest-semantic-matches header and a match tag for approximate results', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayResults([semanticHitToSearchResult(semHit())]);
    const out = stripAnsi(spy.mock.calls.map(c => c.join(' ')).join('\n'));
    spy.mockRestore();
    expect(out).toContain('closest semantic matches');
    expect(out).toContain('{hybrid}');
  });

  it('does NOT print the semantic header for normal keyword results', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayResults([recordToSearchResult({ domain: 'a.io', record_id: 'r', type: 'mcp', name: 'R' })]);
    const out = stripAnsi(spy.mock.calls.map(c => c.join(' ')).join('\n'));
    spy.mockRestore();
    expect(out).not.toContain('closest semantic matches');
    expect(out).not.toContain('{');
  });
});

describe('cmdSearch --json approximate flag', () => {
  beforeEach(() => mockFetchJSON.mockReset());

  it('includes approximate:true in JSON when results come from the semantic tier', async () => {
    mockFetchJSON.mockImplementation(((url?: string) => {
      const u = String(url ?? '');
      if (u.includes('/api/records')) return Promise.resolve({ records: [], total: 0, page: 1, pages: 0 });
      if (u.includes('/api/search')) return Promise.resolve({ query: 'usdc', type_filter: null, total: 1, degraded: false, results: [semHit()] });
      return Promise.resolve({ records: [] });
    }) as typeof fetchJSON);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmdSearch(['usdc'], { json: true });
    const out = spy.mock.calls.map(c => String(c[0])).join('\n');
    spy.mockRestore();
    const parsed = JSON.parse(out);
    expect(parsed.approximate).toBe(true);
    expect(parsed.results[0].match).toBe('hybrid');
  });
});
