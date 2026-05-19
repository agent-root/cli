import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('node:fs', () => {
  const mkdirSync = vi.fn();
  const writeFileSync = vi.fn();
  return {
    default: { mkdirSync, writeFileSync },
    mkdirSync, writeFileSync,
  };
});

vi.mock('@agent-root/core', async () => {
  const actual = await vi.importActual<typeof import('@agent-root/core')>('@agent-root/core');
  return {
    ...actual,
    readInstalledState: vi.fn(),
    upsertInstalled: vi.fn(),
    hashContent: vi.fn(),
  };
});

vi.mock('../../src/services/http/fetch', () => ({
  fetch: vi.fn(),
}));

import fs from 'node:fs';
import * as core from '@agent-root/core';
import { fetch } from '../../src/services/http/fetch';
import { cmdUpdate } from '../../src/commands/update';
import { setJsonModeForTest } from '../../src/cli/fatal';
import { EXIT } from '../../src/cli/exit-codes';

let exitSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.mocked(fs.mkdirSync).mockReset();
  vi.mocked(fs.writeFileSync).mockReset();
  vi.mocked(core.readInstalledState).mockReset();
  vi.mocked(core.upsertInstalled).mockReset();
  vi.mocked(core.hashContent).mockReset();
  vi.mocked(fetch).mockReset();
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

describe('cmdUpdate (no positional, --all path)', () => {
  it('prints "No installed" when state is empty', async () => {
    vi.mocked(core.readInstalledState).mockReturnValue({ installed: {} });
    await cmdUpdate([], {});
    const joined = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(joined).toMatch(/No AgentRoot records installed/);
  });

  it('updates a single skill when fetched content differs', async () => {
    vi.mocked(core.readInstalledState).mockReturnValue({
      installed: {
        'x.com/r': {
          domain: 'x.com', record_id: 'r', type: 'skill', name: 'R',
          source_url: 'https://x/SKILL.md',
          version_hash: 'old-hash',
          tools: { claude: { path: '/p', link_type: 'symlink' } },
        } as never,
      },
    });
    vi.mocked(fetch).mockResolvedValue('new content');
    vi.mocked(core.hashContent).mockReturnValue('new-hash');
    await cmdUpdate([], {});
    expect(core.upsertInstalled).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('marks a record up-to-date when hash matches', async () => {
    vi.mocked(core.readInstalledState).mockReturnValue({
      installed: {
        'x.com/r': {
          domain: 'x.com', record_id: 'r', type: 'skill', name: 'R',
          source_url: 'https://x/SKILL.md',
          version_hash: 'same-hash',
          tools: {},
        } as never,
      },
    });
    vi.mocked(fetch).mockResolvedValue('same');
    vi.mocked(core.hashContent).mockReturnValue('same-hash');
    await cmdUpdate([], {});
    expect(core.upsertInstalled).not.toHaveBeenCalled();
  });

  it('skips records without source_url', async () => {
    vi.mocked(core.readInstalledState).mockReturnValue({
      installed: {
        'x.com/r': {
          domain: 'x.com', record_id: 'r', type: 'skill', name: 'R',
          source_url: undefined,
          tools: {},
        } as never,
      },
    });
    await cmdUpdate([], {});
    expect(fetch).not.toHaveBeenCalled();
  });

  it('records a failure when fetch throws', async () => {
    vi.mocked(core.readInstalledState).mockReturnValue({
      installed: {
        'x.com/r': {
          domain: 'x.com', record_id: 'r', type: 'skill', name: 'R',
          source_url: 'https://x/SKILL.md',
          version_hash: 'h',
          tools: {},
        } as never,
      },
    });
    vi.mocked(fetch).mockRejectedValue(new Error('404'));
    await cmdUpdate([], {});
    const joined = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(joined).toMatch(/fail/);
  });
});

describe('cmdUpdate (single positional)', () => {
  it('fatals USAGE when positional lacks slash', async () => {
    vi.mocked(core.readInstalledState).mockReturnValue({ installed: {} });
    await expect(cmdUpdate(['no-slash'], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.USAGE);
  });

  it('reports not-found when key is missing', async () => {
    vi.mocked(core.readInstalledState).mockReturnValue({ installed: {} });
    await cmdUpdate(['x.com/missing'], {});
    const joined = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(joined).toMatch(/No AgentRoot installation found/);
  });

  it('--json not-found returns the structured envelope', async () => {
    vi.mocked(core.readInstalledState).mockReturnValue({ installed: {} });
    await cmdUpdate(['x.com/missing'], { json: true });
    const parsed = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    expect(parsed.status).toBe('not-found');
  });

  it('fatals CONFIG when source_url is missing for the entry', async () => {
    vi.mocked(core.readInstalledState).mockReturnValue({
      installed: {
        'x.com/r': {
          domain: 'x.com', record_id: 'r', type: 'skill', name: 'R',
          source_url: undefined,
          tools: {},
        } as never,
      },
    });
    await expect(cmdUpdate(['x.com/r'], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.CONFIG);
  });

  it('fatals UNAVAILABLE when fetch fails', async () => {
    vi.mocked(core.readInstalledState).mockReturnValue({
      installed: {
        'x.com/r': {
          domain: 'x.com', record_id: 'r', type: 'skill', name: 'R',
          source_url: 'https://x/SKILL.md',
          version_hash: 'h', tools: {},
        } as never,
      },
    });
    vi.mocked(fetch).mockRejectedValue(new Error('refused'));
    await expect(cmdUpdate(['x.com/r'], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.UNAVAILABLE);
  });

  it('happy path: writes new content and emits --json envelope', async () => {
    vi.mocked(core.readInstalledState).mockReturnValue({
      installed: {
        'x.com/r': {
          domain: 'x.com', record_id: 'r', type: 'skill', name: 'R',
          source_url: 'https://x/SKILL.md',
          version_hash: 'old', tools: { claude: { path: '/p', link_type: 'copy' } },
        } as never,
      },
    });
    vi.mocked(fetch).mockResolvedValue('new content');
    vi.mocked(core.hashContent).mockReturnValue('new-hash');
    await cmdUpdate(['x.com/r'], { json: true });
    const parsed = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    expect(parsed.status).toBe('success');
    expect(parsed.version_hash).toBe('new-hash');
  });

  it('no-changes path: writes JSON envelope when hash matches', async () => {
    vi.mocked(core.readInstalledState).mockReturnValue({
      installed: {
        'x.com/r': {
          domain: 'x.com', record_id: 'r', type: 'skill', name: 'R',
          source_url: 'https://x/SKILL.md',
          version_hash: 'same', tools: {},
        } as never,
      },
    });
    vi.mocked(fetch).mockResolvedValue('same');
    vi.mocked(core.hashContent).mockReturnValue('same');
    await cmdUpdate(['x.com/r'], { json: true });
    const parsed = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    expect(parsed.status).toBe('no-changes');
  });
});
