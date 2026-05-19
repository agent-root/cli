import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/services/install/resolve-skills-from-record', () => ({
  resolveSkillsFromRecord: vi.fn(),
}));
vi.mock('../../../src/services/install/fetch-skills-from-registry', () => ({
  fetchSkillsFromRegistry: vi.fn(),
}));

import { resolveSkillsFromRecord } from '../../../src/services/install/resolve-skills-from-record';
import { fetchSkillsFromRegistry } from '../../../src/services/install/fetch-skills-from-registry';
import { gatherSkillsToInstall } from '../../../src/services/install/gather-skills';
import type { JsonOut } from '../../../src/types/install';

const baseJsonOut: JsonOut = { status: 'success', domain: '', recordId: '', type: null, installed: [], skipped: [], errors: [] };

beforeEach(() => {
  vi.mocked(resolveSkillsFromRecord).mockReset();
  vi.mocked(fetchSkillsFromRegistry).mockReset();
});

describe('gatherSkillsToInstall', () => {
  it('resolves from record when record is present and installAll=false', async () => {
    vi.mocked(resolveSkillsFromRecord).mockResolvedValue([{ id: 'a', name: 'A', description: '', url: 'u', domain: 'd' }]);
    const out = await gatherSkillsToInstall({
      domain: 'x.com',
      recordId: 'r',
      record: { skill_md: 'u' },
      manifest: null,
      installAll: false,
      isProject: false,
      flags: { json: true },
      jsonOut: baseJsonOut,
    });
    expect(out).toHaveLength(1);
    expect(resolveSkillsFromRecord).toHaveBeenCalledOnce();
    expect(fetchSkillsFromRegistry).not.toHaveBeenCalled();
  });

  it('resolves from manifest.records (filtered to skills) when installAll=true', async () => {
    vi.mocked(resolveSkillsFromRecord)
      .mockResolvedValueOnce([{ id: 'a', name: 'A', description: '', url: 'u1', domain: 'd' }])
      .mockResolvedValueOnce([{ id: 'b', name: 'B', description: '', url: 'u2', domain: 'd' }]);
    const out = await gatherSkillsToInstall({
      domain: 'x.com',
      recordId: null,
      record: null,
      manifest: {
        records: [
          { type: 'skill', id: 'a' },
          { type: 'mcp', id: 'm' },
          { type: 'skill', id: 'b' },
        ],
      },
      installAll: true,
      isProject: false,
      flags: { json: true },
      jsonOut: baseJsonOut,
    });
    expect(out).toHaveLength(2);
    expect(resolveSkillsFromRecord).toHaveBeenCalledTimes(2);
  });

  it('falls back to the registry when record resolution yields zero skills', async () => {
    vi.mocked(resolveSkillsFromRecord).mockResolvedValue([]);
    vi.mocked(fetchSkillsFromRegistry).mockResolvedValue([
      { id: 'reg', name: 'Reg', description: '', url: 'u', domain: 'd' },
    ]);
    const out = await gatherSkillsToInstall({
      domain: 'x.com',
      recordId: 'r',
      record: { type: 'skill' },
      manifest: null,
      installAll: false,
      isProject: false,
      flags: { json: true },
      jsonOut: baseJsonOut,
    });
    expect(out).toHaveLength(1);
    expect(fetchSkillsFromRegistry).toHaveBeenCalledOnce();
  });

  it('falls back to the registry when manifest has no skill records', async () => {
    vi.mocked(fetchSkillsFromRegistry).mockResolvedValue([
      { id: 'reg', name: 'Reg', description: '', url: 'u', domain: 'd' },
    ]);
    const out = await gatherSkillsToInstall({
      domain: 'x.com',
      recordId: null,
      record: null,
      manifest: { records: [{ type: 'mcp', id: 'mcp1' }] },
      installAll: true,
      isProject: false,
      flags: { json: true },
      jsonOut: baseJsonOut,
    });
    expect(out).toHaveLength(1);
    expect(fetchSkillsFromRegistry).toHaveBeenCalled();
  });

  it('returns empty when neither record/manifest nor registry have skills', async () => {
    vi.mocked(fetchSkillsFromRegistry).mockResolvedValue([]);
    const out = await gatherSkillsToInstall({
      domain: 'x.com',
      recordId: 'r',
      record: null,
      manifest: null,
      installAll: false,
      isProject: false,
      flags: { json: true },
      jsonOut: baseJsonOut,
    });
    expect(out).toHaveLength(0);
  });
});
