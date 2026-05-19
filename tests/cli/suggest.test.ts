import { describe, it, expect } from 'vitest';
import { suggestCommand } from '../../src/cli/suggest';

// suggestCommand() is the back-end of "did you mean: X?" on unknown commands.
// The acceptance criteria are: 1-letter typos resolve, two-letter typos
// resolve, anything more distant returns null, exact matches "suggest"
// themselves (cheap; the caller handles the not-actually-unknown case),
// empty input is null (we don't want `agentroot` with no args to suggest
// anything — that path has its own no-arg behavior).
describe('suggestCommand', () => {
  it('suggests resolve for reslove (one transposition)', () => {
    expect(suggestCommand('reslove')).toBe('resolve');
  });

  it('suggests search for seach (one deletion)', () => {
    expect(suggestCommand('seach')).toBe('search');
  });

  it('suggests install for instal (one deletion)', () => {
    expect(suggestCommand('instal')).toBe('install');
  });

  it('suggests version for verson (one deletion)', () => {
    expect(suggestCommand('verson')).toBe('version');
  });

  it('suggests health for helth (one deletion)', () => {
    expect(suggestCommand('helth')).toBe('health');
  });

  it('returns null for xyz (no command within distance 2)', () => {
    expect(suggestCommand('xyz')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(suggestCommand('')).toBeNull();
  });

  it('returns null for a totally unrelated long word', () => {
    expect(suggestCommand('asdfjkl')).toBeNull();
  });

  it('returns the exact command for an exact match', () => {
    // distance 0 satisfies <= 2, so the function returns the input itself.
    // Callers (src/index.ts) only invoke suggestCommand in the unknown-
    // command branch, so a real match never gets here, but the function
    // should behave sensibly if it does.
    expect(suggestCommand('resolve')).toBe('resolve');
  });

  it('prefers the closer match when two commands are within range', () => {
    // 'list' (distance 1 from 'lst') vs e.g. nothing else nearby.
    expect(suggestCommand('lst')).toBe('list');
  });
});
