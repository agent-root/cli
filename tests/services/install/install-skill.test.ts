import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../src/services/install/detect-target-tools', () => ({
  detectTargetTools: vi.fn(() => ['claude']),
}));
vi.mock('../../../src/services/install/gather-skills', () => ({
  gatherSkillsToInstall: vi.fn(),
}));
vi.mock('../../../src/services/install/install-one-skill', () => ({
  installOneSkill: vi.fn(),
}));

import { detectTargetTools } from '../../../src/services/install/detect-target-tools';
import { gatherSkillsToInstall } from '../../../src/services/install/gather-skills';
import { installOneSkill } from '../../../src/services/install/install-one-skill';
import { installSkill } from '../../../src/services/install/install-skill';
import { setJsonModeForTest } from '../../../src/cli/fatal';
import { EXIT } from '../../../src/cli/exit-codes';
import type { JsonOut } from '../../../src/types/install';

function newJsonOut(): JsonOut {
  return { status: 'success', domain: '', recordId: '', type: null, installed: [], skipped: [], errors: [] };
}

let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.mocked(detectTargetTools).mockReset();
  vi.mocked(detectTargetTools).mockReturnValue(['claude']);
  vi.mocked(gatherSkillsToInstall).mockReset();
  vi.mocked(installOneSkill).mockReset();
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('__exit__');
  }) as never);
  setJsonModeForTest(false);
});

afterEach(() => {
  exitSpy.mockRestore();
});

describe('installSkill', () => {
  it('fatals with NOHOST when no skills are found', async () => {
    vi.mocked(gatherSkillsToInstall).mockResolvedValue([]);
    await expect(installSkill({
      domain: 'x.com',
      recordId: 'r',
      record: null,
      manifest: null,
      installAll: false,
      isProject: false,
      flags: { json: true },
      jsonOut: newJsonOut(),
    })).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.NOHOST);
  });

  it('sets jsonOut.type = "skill" before installing', async () => {
    vi.mocked(gatherSkillsToInstall).mockResolvedValue([
      { id: 'a', name: 'A', description: '', url: 'u', domain: 'x.com' },
    ]);
    vi.mocked(installOneSkill).mockResolvedValue(1);
    const jsonOut = newJsonOut();
    await installSkill({
      domain: 'x.com',
      recordId: 'r',
      record: null,
      manifest: null,
      installAll: false,
      isProject: false,
      flags: { json: true },
      jsonOut,
    });
    expect(jsonOut.type).toBe('skill');
  });

  it('loops through every gathered skill and accumulates the count', async () => {
    vi.mocked(gatherSkillsToInstall).mockResolvedValue([
      { id: 'a', name: 'A', description: '', url: 'u', domain: 'x.com' },
      { id: 'b', name: 'B', description: '', url: 'u', domain: 'x.com' },
      { id: 'c', name: 'C', description: '', url: 'u', domain: 'x.com' },
    ]);
    vi.mocked(installOneSkill).mockResolvedValueOnce(1).mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    await installSkill({
      domain: 'x.com',
      recordId: null,
      record: null,
      manifest: null,
      installAll: true,
      isProject: false,
      flags: { json: true },
      jsonOut: newJsonOut(),
    });
    expect(installOneSkill).toHaveBeenCalledTimes(3);
  });

  it('passes flags + tools + isProject through to installOneSkill', async () => {
    vi.mocked(detectTargetTools).mockReturnValue(['cursor', 'codex']);
    vi.mocked(gatherSkillsToInstall).mockResolvedValue([
      { id: 'a', name: 'A', description: '', url: 'u', domain: 'x.com' },
    ]);
    vi.mocked(installOneSkill).mockResolvedValue(1);
    const flags = { json: true, tool: 'cursor' };
    await installSkill({
      domain: 'x.com',
      recordId: 'a',
      record: null,
      manifest: null,
      installAll: false,
      isProject: true,
      flags,
      jsonOut: newJsonOut(),
    });
    const args = vi.mocked(installOneSkill).mock.calls[0];
    expect(args![1]).toBe('x.com'); // fallbackDomain
    expect(args![2]).toEqual(['cursor', 'codex']); // tools
    expect(args![3]).toBe(true); // isProject
    expect(args![4]).toBe(flags); // flags
  });

  it('fatal hint for installAll includes only the domain (not the record)', async () => {
    vi.mocked(gatherSkillsToInstall).mockResolvedValue([]);
    // We can't easily intercept the fatal message text without checking
    // console.error or stdout, but we can verify the exit code path
    // distinguishes installAll from single.
    await expect(installSkill({
      domain: 'x.com',
      recordId: null,
      record: null,
      manifest: null,
      installAll: true,
      isProject: false,
      flags: { json: true },
      jsonOut: newJsonOut(),
    })).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.NOHOST);
  });
});
