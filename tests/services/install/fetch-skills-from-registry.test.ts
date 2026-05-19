import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/services/http/fetch', () => ({
  fetchJSON: vi.fn(),
}));

// Pin the API base so the URL we assert against is deterministic.
vi.mock('../../../src/services/config/config-service', () => ({
  getApiBase: () => 'https://api.test',
}));

import { fetchJSON } from '../../../src/services/http/fetch';
import { fetchSkillsFromRegistry } from '../../../src/services/install/fetch-skills-from-registry';

beforeEach(() => {
  vi.mocked(fetchJSON).mockReset();
});

describe('fetchSkillsFromRegistry — single record', () => {
  it('hits /api/skills/<domain>/item/<recordId> for a single fetch', async () => {
    vi.mocked(fetchJSON).mockResolvedValue({
      skill: { skill_md: 'https://x/SKILL.md', name: 'One', id: 'one' },
    });
    const out = await fetchSkillsFromRegistry({
      domain: 'x.com',
      recordId: 'one',
      installAll: false,
      flags: { json: true },
    });
    expect(fetchJSON).toHaveBeenCalledWith('https://api.test/api/skills/x.com/item/one');
    expect(out).toHaveLength(1);
    expect(out[0]!.name).toBe('One');
  });

  it('returns empty array when single-skill registry response has no skill', async () => {
    vi.mocked(fetchJSON).mockResolvedValue({});
    const out = await fetchSkillsFromRegistry({
      domain: 'x.com',
      recordId: 'one',
      installAll: false,
      flags: { json: true },
    });
    expect(out).toHaveLength(0);
  });

  it('returns empty array when single-skill response is missing skill_md', async () => {
    vi.mocked(fetchJSON).mockResolvedValue({ skill: { name: 'NoURL' } });
    const out = await fetchSkillsFromRegistry({
      domain: 'x.com',
      recordId: 'one',
      installAll: false,
      flags: { json: true },
    });
    expect(out).toHaveLength(0);
  });
});

describe('fetchSkillsFromRegistry — installAll', () => {
  it('hits /api/skills/<domain> for the listing endpoint', async () => {
    vi.mocked(fetchJSON).mockResolvedValue({
      skill: {
        skills: [
          { skill_md: 'https://x/a/SKILL.md', name: 'A', id: 'a' },
          { skill_md: 'https://x/b/SKILL.md', name: 'B', id: 'b' },
        ],
      },
    });
    const out = await fetchSkillsFromRegistry({
      domain: 'x.com',
      recordId: null,
      installAll: true,
      flags: { json: true },
    });
    expect(fetchJSON).toHaveBeenCalledWith('https://api.test/api/skills/x.com');
    expect(out).toHaveLength(2);
  });

  it('returns empty array when installAll response has no skills', async () => {
    vi.mocked(fetchJSON).mockResolvedValue({});
    const out = await fetchSkillsFromRegistry({
      domain: 'x.com',
      recordId: null,
      installAll: true,
      flags: { json: true },
    });
    expect(out).toHaveLength(0);
  });

  it('filters out installAll entries that lack a URL', async () => {
    vi.mocked(fetchJSON).mockResolvedValue({
      skill: {
        skills: [
          { skill_md: 'https://x/a/SKILL.md', name: 'A', id: 'a' },
          { name: 'B-no-url', id: 'b' },
        ],
      },
    });
    const out = await fetchSkillsFromRegistry({
      domain: 'x.com',
      recordId: null,
      installAll: true,
      flags: { json: true },
    });
    expect(out).toHaveLength(1);
  });
});

describe('fetchSkillsFromRegistry — error handling', () => {
  it('returns [] when registry fetch throws (single)', async () => {
    vi.mocked(fetchJSON).mockRejectedValue(new Error('502'));
    const out = await fetchSkillsFromRegistry({
      domain: 'x.com',
      recordId: 'one',
      installAll: false,
      flags: { json: true },
    });
    expect(out).toHaveLength(0);
  });

  it('returns [] when registry fetch throws (installAll)', async () => {
    vi.mocked(fetchJSON).mockRejectedValue(new Error('network'));
    const out = await fetchSkillsFromRegistry({
      domain: 'x.com',
      recordId: null,
      installAll: true,
      flags: { json: true },
    });
    expect(out).toHaveLength(0);
  });

  it('encodes domain + recordId in the URL', async () => {
    vi.mocked(fetchJSON).mockResolvedValue({ skill: null });
    await fetchSkillsFromRegistry({
      domain: 'x y.com',
      recordId: 'a/b',
      installAll: false,
      flags: { json: true },
    });
    const calledWith = vi.mocked(fetchJSON).mock.calls[0]?.[0] as string;
    expect(calledWith).toContain('x%20y.com');
    expect(calledWith).toContain('a%2Fb');
  });
});
