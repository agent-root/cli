import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/services/http/fetch', () => ({
  fetchJSON: vi.fn(),
}));
vi.mock('../../src/services/config/config-service', () => ({
  getApiBase: () => 'https://api.test',
}));

import { fetchJSON } from '../../src/services/http/fetch';
import { cmdCollections } from '../../src/commands/collections';
import { setJsonModeForTest } from '../../src/cli/fatal';
import { EXIT } from '../../src/cli/exit-codes';

let exitSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.mocked(fetchJSON).mockReset();
  setJsonModeForTest(false);
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('__exit__');
  }) as never);
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  exitSpy.mockRestore();
  logSpy.mockRestore();
  errSpy.mockRestore();
});

describe('cmdCollections — list (no positional)', () => {
  it('hits /api/collections', async () => {
    vi.mocked(fetchJSON).mockResolvedValue({ items: [], total: 0 });
    await cmdCollections([], {});
    expect(fetchJSON).toHaveBeenCalledWith('https://api.test/api/collections');
  });

  it('renders the list when items exist', async () => {
    vi.mocked(fetchJSON).mockResolvedValue({
      items: [
        { slug: 'foo', name: 'Foo Collection', description: 'desc', item_count: 3 },
        { slug: 'bar', name: 'Bar Collection' },
      ],
      total: 2,
    });
    await cmdCollections([], {});
    const stdout = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(stdout).toMatch(/foo/);
    expect(stdout).toMatch(/Foo Collection/);
    expect(stdout).toMatch(/items: 3/);
  });

  it('--json passes through the raw response', async () => {
    vi.mocked(fetchJSON).mockResolvedValue({
      items: [{ slug: 'foo', name: 'Foo' }], total: 1,
    });
    await cmdCollections([], { json: true });
    const parsed = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    expect(parsed.items).toHaveLength(1);
  });
});

describe('cmdCollections — detail (with positional)', () => {
  it('hits /api/collections/<slug>', async () => {
    vi.mocked(fetchJSON).mockResolvedValue({ slug: 'foo', name: 'Foo', items: [] });
    await cmdCollections(['foo'], {});
    expect(fetchJSON).toHaveBeenCalledWith('https://api.test/api/collections/foo');
  });

  it('encodes special characters in the slug', async () => {
    vi.mocked(fetchJSON).mockResolvedValue({ slug: 'a b', name: 'AB', items: [] });
    await cmdCollections(['a b'], {});
    expect(fetchJSON).toHaveBeenCalledWith(expect.stringContaining('a%20b'));
  });

  it('renders the detail with items', async () => {
    vi.mocked(fetchJSON).mockResolvedValue({
      slug: 'foo',
      name: 'Foo Collection',
      description: 'desc',
      items: [
        { id: 1, type: 'manifest', manifest: { domain: 'x.com', status: 'active', manifest_url: 'https://x.com/agentroot.json' } },
      ],
    });
    await cmdCollections(['foo'], {});
    const stdout = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(stdout).toMatch(/Foo Collection/);
    expect(stdout).toMatch(/x\.com/);
  });

  it('fatals UNAVAILABLE on fetch error', async () => {
    vi.mocked(fetchJSON).mockRejectedValue(new Error('500'));
    await expect(cmdCollections(['foo'], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.UNAVAILABLE);
  });

  it('--json passes through the detail response', async () => {
    vi.mocked(fetchJSON).mockResolvedValue({ slug: 'foo', name: 'Foo', items: [] });
    await cmdCollections(['foo'], { json: true });
    const parsed = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    expect(parsed.slug).toBe('foo');
  });
});
