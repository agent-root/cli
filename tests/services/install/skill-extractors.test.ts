import { describe, it, expect } from 'vitest';
import {
  extractSkillUrl,
  extractSkillId,
  extractSkillName,
} from '../../../src/services/install/skill-extractors';

// These three helpers paper over field-name differences between the registry,
// manifest, and index.json sources. Pure data shaping, no IO.

describe('extractSkillUrl', () => {
  it('prefers skill_md when present', () => {
    expect(extractSkillUrl({ skill_md: 'https://a/SKILL.md', file: 'https://b/SKILL.md' }))
      .toBe('https://a/SKILL.md');
  });

  it('falls back to skill_md_url when skill_md is absent', () => {
    expect(extractSkillUrl({ skill_md_url: 'https://x/SKILL.md' }))
      .toBe('https://x/SKILL.md');
  });

  it('falls back to file when skill_md and skill_md_url are absent', () => {
    expect(extractSkillUrl({ file: 'https://x/file.md' })).toBe('https://x/file.md');
  });

  it('falls back to url as the lowest-priority field', () => {
    expect(extractSkillUrl({ url: 'https://x/u.md' })).toBe('https://x/u.md');
  });

  it('returns undefined when no URL field is present', () => {
    expect(extractSkillUrl({})).toBeUndefined();
    expect(extractSkillUrl({ name: 'foo' })).toBeUndefined();
  });
});

describe('extractSkillId', () => {
  it('prefers skill_id when present', () => {
    expect(extractSkillId({ skill_id: 'abc', slug: 'def', id: 'ghi' }, 'fallback')).toBe('abc');
  });

  it('falls back to slug when skill_id is absent', () => {
    expect(extractSkillId({ slug: 'def', id: 'ghi' }, 'fallback')).toBe('def');
  });

  it('falls back to id when skill_id and slug are absent', () => {
    expect(extractSkillId({ id: 'ghi' }, 'fallback')).toBe('ghi');
  });

  it('falls back to the fallback when no id field is present', () => {
    expect(extractSkillId({}, 'fallback-id')).toBe('fallback-id');
  });

  it('coerces numeric id to string (DB ids are numbers)', () => {
    expect(extractSkillId({ id: 42 }, 'fb')).toBe('42');
  });

  it('returns empty string fallback as ""', () => {
    expect(extractSkillId({}, '')).toBe('');
  });
});

describe('extractSkillName', () => {
  it('prefers name when present', () => {
    expect(extractSkillName({ name: 'My Skill', title: 'Other' }, 'fb')).toBe('My Skill');
  });

  it('falls back to title when name is absent', () => {
    expect(extractSkillName({ title: 'Other' }, 'fb')).toBe('Other');
  });

  it('falls back to fallback when no name field is present', () => {
    expect(extractSkillName({}, 'fallback-name')).toBe('fallback-name');
  });

  it('coerces non-string name to string', () => {
    expect(extractSkillName({ name: 123 }, 'fb')).toBe('123');
  });
});
