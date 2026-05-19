import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/services/dns/dns-service', () => ({
  resolveAgentroot: vi.fn(),
}));
vi.mock('../../src/services/http/fetch', () => ({
  fetchJSON: vi.fn(),
}));
vi.mock('../../src/services/install/install-skill', () => ({
  installSkill: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@agent-root/core', async () => {
  const actual = await vi.importActual<typeof import('@agent-root/core')>('@agent-root/core');
  return {
    ...actual,
    validateManifest: vi.fn(() => ({ valid: true, errors: [] })),
  };
});

import * as core from '@agent-root/core';
import { resolveAgentroot } from '../../src/services/dns/dns-service';
import { fetchJSON } from '../../src/services/http/fetch';
import { installSkill } from '../../src/services/install/install-skill';
import { cmdResolve } from '../../src/commands/resolve';
import { setJsonModeForTest } from '../../src/cli/fatal';
import { EXIT } from '../../src/cli/exit-codes';

let exitSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.mocked(resolveAgentroot).mockReset();
  vi.mocked(fetchJSON).mockReset();
  vi.mocked(installSkill).mockReset();
  vi.mocked(installSkill).mockResolvedValue(undefined);
  vi.mocked(core.validateManifest).mockReset();
  vi.mocked(core.validateManifest).mockReturnValue({ valid: true, errors: [] });
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

describe('cmdResolve', () => {
  it('fatals USAGE when no domain provided', async () => {
    await expect(cmdResolve([], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.USAGE);
  });

  it('fatals NOHOST when DNS returns found:false', async () => {
    vi.mocked(resolveAgentroot).mockResolvedValue({ found: false, error: 'no record' });
    await expect(cmdResolve(['x.com'], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.NOHOST);
  });

  it('manifest mode: fetches and prints records', async () => {
    vi.mocked(resolveAgentroot).mockResolvedValue({
      found: true, mode: 'manifest',
      manifestUrl: 'https://x/agentroot.json', raw: 'x', txtRecords: ['x'],
    });
    vi.mocked(fetchJSON).mockResolvedValue({
      domain: 'x.com',
      records: [{ type: 'mcp', id: 'a' }, { type: 'skill', id: 'b' }],
    });
    await cmdResolve(['x.com'], {});
    expect(fetchJSON).toHaveBeenCalledWith('https://x/agentroot.json');
    const joined = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(joined).toMatch(/2 record\(s\)/);
  });

  it('manifest mode --json: prints full manifest', async () => {
    vi.mocked(resolveAgentroot).mockResolvedValue({
      found: true, mode: 'manifest',
      manifestUrl: 'https://x/agentroot.json', raw: 'x', txtRecords: ['x'],
    });
    vi.mocked(fetchJSON).mockResolvedValue({
      domain: 'x.com',
      records: [{ type: 'mcp', id: 'a' }],
    });
    await cmdResolve(['x.com'], { json: true });
    const parsed = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    expect(parsed.domain).toBe('x.com');
    expect(parsed.records).toHaveLength(1);
  });

  it('manifest mode: fatals UNAVAILABLE on fetch error', async () => {
    vi.mocked(resolveAgentroot).mockResolvedValue({
      found: true, mode: 'manifest',
      manifestUrl: 'https://x/agentroot.json', raw: 'x', txtRecords: ['x'],
    });
    vi.mocked(fetchJSON).mockRejectedValue(new Error('502'));
    await expect(cmdResolve(['x.com'], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.UNAVAILABLE);
  });

  it('manifest mode: fatals USAGE when recordId not found', async () => {
    vi.mocked(resolveAgentroot).mockResolvedValue({
      found: true, mode: 'manifest',
      manifestUrl: 'https://x/agentroot.json', raw: 'x', txtRecords: ['x'],
    });
    vi.mocked(fetchJSON).mockResolvedValue({
      domain: 'x.com',
      records: [{ type: 'mcp', id: 'a' }],
    });
    await expect(cmdResolve(['x.com/missing'], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.USAGE);
  });

  it('manifest mode: filters records by recordId', async () => {
    vi.mocked(resolveAgentroot).mockResolvedValue({
      found: true, mode: 'manifest',
      manifestUrl: 'https://x/agentroot.json', raw: 'x', txtRecords: ['x'],
    });
    vi.mocked(fetchJSON).mockResolvedValue({
      domain: 'x.com',
      records: [{ type: 'mcp', id: 'a' }, { type: 'skill', id: 'b' }],
    });
    await cmdResolve(['x.com/b'], {});
    const joined = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(joined).toMatch(/b/);
  });

  it('skill mode falls through to multi-record DNS handler (single skill)', async () => {
    vi.mocked(resolveAgentroot).mockResolvedValue({
      found: true, mode: 'skill',
      skillUrl: 'https://x/SKILL.md', raw: 'v=ar1 skill=https://x/SKILL.md',
      txtRecords: ['v=ar1 skill=https://x/SKILL.md'],
    });
    await cmdResolve(['x.com'], { noInstall: true });
    expect(installSkill).not.toHaveBeenCalled();
  });

  it('handles inline mode records', async () => {
    vi.mocked(resolveAgentroot).mockResolvedValue({
      found: true, mode: 'inline',
      fields: { type: 'agent', endpoint: 'https://x/agent' },
      raw: 'v=ar1 type=agent endpoint=https://x/agent',
      txtRecords: ['v=ar1 type=agent endpoint=https://x/agent'],
    });
    await cmdResolve(['x.com'], {});
    // Should not crash, prints the TXT records.
    const joined = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(joined.length).toBeGreaterThan(0);
  });

  it('--json multi-record mode emits the records array', async () => {
    vi.mocked(resolveAgentroot).mockResolvedValue({
      found: true, mode: 'skill',
      skillUrl: 'https://x/SKILL.md', raw: 'v=ar1 skill=https://x/SKILL.md',
      txtRecords: ['v=ar1 skill=https://x/SKILL.md'],
    });
    await cmdResolve(['x.com'], { json: true, noInstall: true });
    const parsed = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    expect(parsed.status).toBe('success');
    expect(parsed.domain).toBe('x.com');
    expect(Array.isArray(parsed.records)).toBe(true);
  });

  it('manifest mode: validates manifest and emits warnings on invalid', async () => {
    vi.mocked(resolveAgentroot).mockResolvedValue({
      found: true, mode: 'manifest',
      manifestUrl: 'https://x/agentroot.json', raw: 'x', txtRecords: ['x'],
    });
    vi.mocked(fetchJSON).mockResolvedValue({
      domain: 'x.com',
      records: [{ type: 'mcp', id: 'a' }],
    });
    vi.mocked(core.validateManifest).mockReturnValue({ valid: false, errors: ['bad shape'] });
    await cmdResolve(['x.com'], {});
    const stderr = errSpy.mock.calls.map(c => c[0]).join('\n');
    expect(stderr).toMatch(/validation issues|bad shape/);
  });
});
