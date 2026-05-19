import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch so we can simulate index.json fetches without sockets.
vi.mock('../../../src/services/http/fetch', () => ({
  fetchJSON: vi.fn(),
  fetch: vi.fn(),
}));

import { fetchJSON } from '../../../src/services/http/fetch';
import { resolveSkillsFromRecord } from '../../../src/services/install/resolve-skills-from-record';

beforeEach(() => {
  vi.mocked(fetchJSON).mockReset();
});

describe('resolveSkillsFromRecord', () => {
  it('returns the direct-url skill when record has skill_md', async () => {
    const out = await resolveSkillsFromRecord({
      record: { skill_md: 'https://x/SKILL.md', name: 'Foo' },
      domain: 'x.com',
      recordId: 'foo',
      flags: { json: true },
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.url).toBe('https://x/SKILL.md');
    expect(out[0]!.name).toBe('Foo');
    expect(out[0]!.domain).toBe('x.com');
    expect(fetchJSON).not.toHaveBeenCalled();
  });

  it('uses the record id as fallback when name is absent', async () => {
    const out = await resolveSkillsFromRecord({
      record: { skill_md: 'https://x/SKILL.md' },
      domain: 'x.com',
      recordId: 'fallback-id',
      flags: { json: true },
    });
    expect(out[0]!.name).toBe('fallback-id');
    expect(out[0]!.id).toBe('fallback-id');
  });

  it('iterates a record.skills array when no direct skill_md is present', async () => {
    const out = await resolveSkillsFromRecord({
      record: {
        skills: [
          { skill_md: 'https://x/a/SKILL.md', name: 'A', id: 'a' },
          { skill_md: 'https://x/b/SKILL.md', name: 'B', id: 'b' },
        ],
      },
      domain: 'x.com',
      recordId: 'parent',
      flags: { json: true },
    });
    expect(out).toHaveLength(2);
    expect(out[0]!.id).toBe('a');
    expect(out[1]!.id).toBe('b');
  });

  it('skips entries in record.skills that have no URL', async () => {
    const out = await resolveSkillsFromRecord({
      record: { skills: [{ name: 'no-url' }, { skill_md: 'https://x/SKILL.md', name: 'has-url' }] },
      domain: 'x.com',
      recordId: 'parent',
      flags: { json: true },
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.name).toBe('has-url');
  });

  it('fetches the index when no direct URL or skills array is present', async () => {
    vi.mocked(fetchJSON).mockResolvedValue({
      skills: [
        { skill_md: 'https://x/from-idx/SKILL.md', name: 'FromIdx' },
      ],
    });
    const out = await resolveSkillsFromRecord({
      record: { index: 'https://x/index.json' },
      domain: 'x.com',
      recordId: 'r',
      flags: { json: true },
    });
    expect(fetchJSON).toHaveBeenCalledWith('https://x/index.json');
    expect(out).toHaveLength(1);
    expect(out[0]!.name).toBe('FromIdx');
  });

  it('returns empty when index fetch throws', async () => {
    vi.mocked(fetchJSON).mockRejectedValue(new Error('net err'));
    const out = await resolveSkillsFromRecord({
      record: { index: 'https://x/index.json' },
      domain: 'x.com',
      recordId: 'r',
      flags: { json: true },
    });
    expect(out).toHaveLength(0);
  });

  it('returns empty when no skill_md, no skills array, no index', async () => {
    const out = await resolveSkillsFromRecord({
      record: { type: 'skill', id: 'r' },
      domain: 'x.com',
      recordId: 'r',
      flags: { json: true },
    });
    expect(out).toHaveLength(0);
  });

  it('does NOT consult index when skills array already produced results', async () => {
    const out = await resolveSkillsFromRecord({
      record: {
        skills: [{ skill_md: 'https://x/SKILL.md', name: 'A' }],
        index: 'https://x/index.json',
      },
      domain: 'x.com',
      recordId: 'r',
      flags: { json: true },
    });
    expect(fetchJSON).not.toHaveBeenCalled();
    expect(out).toHaveLength(1);
  });

  it('captures description from the record', async () => {
    const out = await resolveSkillsFromRecord({
      record: { skill_md: 'https://x/SKILL.md', description: 'this is a skill' },
      domain: 'x.com',
      recordId: 'r',
      flags: { json: true },
    });
    expect(out[0]!.description).toBe('this is a skill');
  });
});
