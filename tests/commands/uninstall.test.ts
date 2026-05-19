import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('node:fs', () => {
  const existsSync = vi.fn();
  const rmSync = vi.fn();
  return {
    default: { existsSync, rmSync },
    existsSync, rmSync,
  };
});

vi.mock('@agent-root/core', async () => {
  const actual = await vi.importActual<typeof import('@agent-root/core')>('@agent-root/core');
  return {
    ...actual,
    readInstalledState: vi.fn(() => ({ installed: {} })),
    removeInstalledState: vi.fn(),
  };
});

vi.mock('../../src/cli/confirm', () => ({
  confirmAction: vi.fn(),
}));

import fs from 'node:fs';
import * as core from '@agent-root/core';
import { confirmAction } from '../../src/cli/confirm';
import { cmdUninstall } from '../../src/commands/uninstall';
import { setJsonModeForTest } from '../../src/cli/fatal';
import { EXIT } from '../../src/cli/exit-codes';

let exitSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.mocked(fs.existsSync).mockReset();
  vi.mocked(fs.rmSync).mockReset();
  vi.mocked(core.readInstalledState).mockReset();
  vi.mocked(core.removeInstalledState).mockReset();
  vi.mocked(confirmAction).mockReset();
  vi.mocked(confirmAction).mockResolvedValue(true);
  setJsonModeForTest(false);
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('__exit__');
  }) as never);
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
});

afterEach(() => {
  exitSpy.mockRestore();
  logSpy.mockRestore();
  errSpy.mockRestore();
});

describe('cmdUninstall', () => {
  it('prints "No installed" when state is empty and no positional', async () => {
    vi.mocked(core.readInstalledState).mockReturnValue({ installed: {} });
    await cmdUninstall([], {});
    const joined = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(joined).toMatch(/No AgentRoot records installed/);
  });

  it('fatals USAGE when no positional + non-TTY + records exist', async () => {
    vi.mocked(core.readInstalledState).mockReturnValue({
      installed: { 'x.com/r': { domain: 'x.com', record_id: 'r', type: 'skill', name: 'X', tools: {} } as never },
    });
    await expect(cmdUninstall([], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.USAGE);
  });

  it('fatals USAGE when positional lacks the slash', async () => {
    vi.mocked(core.readInstalledState).mockReturnValue({ installed: {} });
    await expect(cmdUninstall(['no-slash'], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.USAGE);
  });

  it('reports not-found for a key that does not exist', async () => {
    vi.mocked(core.readInstalledState).mockReturnValue({ installed: {} });
    await cmdUninstall(['x.com/missing'], {});
    const joined = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(joined).toMatch(/No AgentRoot installation found/);
  });

  it('JSON not-found returns a structured envelope', async () => {
    vi.mocked(core.readInstalledState).mockReturnValue({ installed: {} });
    await cmdUninstall(['x.com/missing'], { json: true });
    const parsed = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    expect(parsed.status).toBe('not-found');
  });

  it('cancels when user declines the confirm', async () => {
    vi.mocked(core.readInstalledState).mockReturnValue({
      installed: {
        'x.com/r': { domain: 'x.com', record_id: 'r', type: 'skill', name: 'R', tools: {} } as never,
      },
    });
    vi.mocked(confirmAction).mockResolvedValue(false);
    await cmdUninstall(['x.com/r'], {});
    expect(fs.rmSync).not.toHaveBeenCalled();
    expect(core.removeInstalledState).not.toHaveBeenCalled();
  });

  it('removes the canonical dir and every tool symlink on confirm', async () => {
    vi.mocked(core.readInstalledState).mockReturnValue({
      installed: {
        'x.com/r': {
          domain: 'x.com', record_id: 'r', type: 'skill', name: 'R',
          tools: {
            claude: { path: '/home/.agents/claude/x.com/r', link_type: 'symlink' },
            cursor: { path: '/home/.agents/cursor/x.com/r', link_type: 'symlink' },
          },
        } as never,
      },
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    await cmdUninstall(['x.com/r'], {});
    expect(fs.rmSync).toHaveBeenCalledWith('/home/.agents/claude/x.com/r', { recursive: true, force: true });
    expect(fs.rmSync).toHaveBeenCalledWith('/home/.agents/cursor/x.com/r', { recursive: true, force: true });
    expect(core.removeInstalledState).toHaveBeenCalledWith('x.com', 'r');
  });

  it('emits a JSON success envelope when --json', async () => {
    vi.mocked(core.readInstalledState).mockReturnValue({
      installed: {
        'x.com/r': {
          domain: 'x.com', record_id: 'r', type: 'skill', name: 'R',
          tools: { claude: { path: '/p', link_type: 'symlink' } },
        } as never,
      },
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    await cmdUninstall(['x.com/r'], { json: true });
    const parsed = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    expect(parsed.status).toBe('success');
    expect(parsed.removed).toHaveLength(1);
  });

  it('fatals NOPERM when rmSync throws EACCES', async () => {
    vi.mocked(core.readInstalledState).mockReturnValue({
      installed: {
        'x.com/r': {
          domain: 'x.com', record_id: 'r', type: 'skill', name: 'R',
          tools: { claude: { path: '/p', link_type: 'symlink' } },
        } as never,
      },
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.rmSync).mockImplementation(() => {
      const err = new Error('perm') as NodeJS.ErrnoException;
      err.code = 'EACCES';
      throw err;
    });
    await expect(cmdUninstall(['x.com/r'], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.NOPERM);
  });
});
