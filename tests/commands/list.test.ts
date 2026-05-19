import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@agent-root/core', async () => {
  const actual = await vi.importActual<typeof import('@agent-root/core')>('@agent-root/core');
  return {
    ...actual,
    readInstalledState: vi.fn(() => ({ installed: {} })),
  };
});

import * as core from '@agent-root/core';
import { cmdList } from '../../src/commands/list';

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.mocked(core.readInstalledState).mockReset();
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  logSpy.mockRestore();
  errSpy.mockRestore();
});

describe('cmdList', () => {
  it('empty state: prints "No AgentRoot records installed."', async () => {
    vi.mocked(core.readInstalledState).mockReturnValue({ installed: {} });
    await cmdList([], {});
    const joined = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(joined).toMatch(/No AgentRoot records installed/);
  });

  it('--json with empty state emits {records:[]}', async () => {
    vi.mocked(core.readInstalledState).mockReturnValue({ installed: {} });
    await cmdList([], { json: true });
    const parsed = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    expect(parsed.records).toEqual([]);
  });

  it('renders each installed record (human mode)', async () => {
    vi.mocked(core.readInstalledState).mockReturnValue({
      installed: {
        'x.com/skill-a': {
          domain: 'x.com',
          record_id: 'skill-a',
          type: 'skill',
          name: 'A',
          description: 'desc',
          source_url: 'u',
          version_hash: 'abcd1234',
          installed_at: '2026-01-02T03:04:05Z',
          tools: { claude: { path: '/home/.agents/claude/x.com/skill-a', link_type: 'symlink' } },
        },
      },
    });
    await cmdList([], {});
    const joined = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(joined).toMatch(/Installed AgentRoot Records/);
    expect(joined).toMatch(/skill-a/);
    expect(joined).toMatch(/2026-01-02/);
    expect(joined).toMatch(/symlink/);
  });

  it('--json emits a records[] with each entry', async () => {
    vi.mocked(core.readInstalledState).mockReturnValue({
      installed: {
        'x.com/r': {
          domain: 'x.com',
          record_id: 'r',
          type: 'skill',
          name: 'X',
          tools: {},
        } as never,
      },
    });
    await cmdList([], { json: true });
    const parsed = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0].key).toBe('x.com/r');
    expect(parsed.records[0].domain).toBe('x.com');
  });

  it('handles missing installed_at gracefully', async () => {
    vi.mocked(core.readInstalledState).mockReturnValue({
      installed: {
        'x.com/r': {
          domain: 'x.com',
          record_id: 'r',
          type: 'skill',
          name: 'X',
          tools: {},
        } as never,
      },
    });
    await cmdList([], {});
    const joined = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(joined).toMatch(/unknown/);
  });

  it('renders total record count footer', async () => {
    vi.mocked(core.readInstalledState).mockReturnValue({
      installed: {
        'x.com/a': { domain: 'x.com', record_id: 'a', type: 'skill', name: 'A', tools: {} } as never,
        'x.com/b': { domain: 'x.com', record_id: 'b', type: 'skill', name: 'B', tools: {} } as never,
      },
    });
    await cmdList([], {});
    const joined = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(joined).toMatch(/2 record\(s\) total/);
  });
});
