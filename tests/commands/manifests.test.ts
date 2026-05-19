import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/services/http/fetch', () => ({
  fetchJSON: vi.fn(),
}));
vi.mock('../../src/services/config/config-service', () => ({
  getApiBase: () => 'https://api.test',
}));

import { fetchJSON } from '../../src/services/http/fetch';
import { cmdManifests, listManifests } from '../../src/commands/manifests';

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.mocked(fetchJSON).mockReset();
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  logSpy.mockRestore();
  errSpy.mockRestore();
});

describe('listManifests', () => {
  it('shapes the envelope from the raw API response', async () => {
    vi.mocked(fetchJSON).mockResolvedValue({
      manifests: [{ domain: 'a.com' }, { domain: 'b.com' }],
      total: 2, page: 1, pages: 1,
    });
    const env = await listManifests({ query: '', typeFilter: '', page: 1, limit: 20 });
    expect(env.manifests).toHaveLength(2);
    expect(env.total).toBe(2);
    expect(env.page).toBe(1);
    expect(env.limit).toBe(20);
  });

  it('defaults missing API fields safely', async () => {
    vi.mocked(fetchJSON).mockResolvedValue({});
    const env = await listManifests({ query: '', typeFilter: '', page: 1, limit: 20 });
    expect(env.manifests).toEqual([]);
    expect(env.total).toBe(0);
    expect(env.page).toBe(1);
    expect(env.pages).toBe(1);
  });

  it('passes query and type into the URL params', async () => {
    vi.mocked(fetchJSON).mockResolvedValue({ manifests: [], total: 0, page: 1, pages: 1 });
    await listManifests({ query: 'foo', typeFilter: 'skill', page: 2, limit: 10 });
    const url = vi.mocked(fetchJSON).mock.calls[0]?.[0] as string;
    expect(url).toContain('q=foo');
    expect(url).toContain('type=skill');
    expect(url).toContain('page=2');
    expect(url).toContain('limit=10');
  });
});

describe('cmdManifests', () => {
  it('renders empty state', async () => {
    vi.mocked(fetchJSON).mockResolvedValue({ manifests: [], total: 0, page: 1, pages: 0 });
    await cmdManifests([], {});
    // Spinner.warn writes to stderr; we just confirm no rows on stdout.
    const stdout = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(stdout).not.toMatch(/manifest:/);
  });

  it('--json renders an empty envelope on empty result', async () => {
    vi.mocked(fetchJSON).mockResolvedValue({ manifests: [], total: 0, page: 1, pages: 0 });
    await cmdManifests([], { json: true });
    const parsed = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    expect(parsed.manifests).toEqual([]);
    expect(parsed.total).toBe(0);
  });

  it('renders rows in human mode', async () => {
    vi.mocked(fetchJSON).mockResolvedValue({
      manifests: [
        { domain: 'a.com', status: 'active', manifest_url: 'https://a.com/agentroot.json', last_verified: '2026-01-01T00:00:00Z' },
        { domain: 'b.com', status: 'pending', manifest_url: 'https://b.com/agentroot.json' },
      ],
      total: 2, page: 1, pages: 1,
    });
    await cmdManifests([], {});
    const stdout = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(stdout).toMatch(/a\.com/);
    expect(stdout).toMatch(/b\.com/);
    expect(stdout).toMatch(/manifest:/);
  });

  it('--json renders the full envelope when results exist', async () => {
    vi.mocked(fetchJSON).mockResolvedValue({
      manifests: [{ domain: 'a.com', status: 'active' }],
      total: 1, page: 1, pages: 1,
    });
    await cmdManifests([], { json: true });
    const parsed = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    expect(parsed.manifests[0].domain).toBe('a.com');
  });

  it('renders record_counts when present', async () => {
    vi.mocked(fetchJSON).mockResolvedValue({
      manifests: [{ domain: 'a.com', status: 'active', record_counts: { skill: 3, mcp: 1 } }],
      total: 1, page: 1, pages: 1,
    });
    await cmdManifests([], {});
    const joined = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(joined).toMatch(/skill=3/);
    expect(joined).toMatch(/mcp=1/);
  });
});
