import { describe, it, expect } from 'vitest';
import { normalizeTools } from '../../src/utils/normalize-tools';

describe('normalizeTools', () => {
  it('maps a string array to named tools', () => {
    expect(normalizeTools(['search', 'get_info'])).toEqual([{ name: 'search' }, { name: 'get_info' }]);
  });

  it('passes through {name, description} objects', () => {
    expect(normalizeTools([{ name: 'query', description: 'Run SQL' }])).toEqual([{ name: 'query', description: 'Run SQL' }]);
  });

  it('drops description when absent or non-string', () => {
    expect(normalizeTools([{ name: 'a' }, { name: 'b', description: 42 }])).toEqual([{ name: 'a' }, { name: 'b' }]);
  });

  it('handles a mixed array (strings + objects)', () => {
    expect(normalizeTools(['search', { name: 'query', description: 'q' }])).toEqual([{ name: 'search' }, { name: 'query', description: 'q' }]);
  });

  it('skips name-less objects, numbers, null, and empty/whitespace strings', () => {
    expect(normalizeTools([{ description: 'no name' }, 7, null, '', '   ', { name: '' }])).toEqual([]);
  });

  it('trims tool names', () => {
    expect(normalizeTools(['  search  '])).toEqual([{ name: 'search' }]);
  });

  it('returns [] for non-array input', () => {
    expect(normalizeTools(undefined)).toEqual([]);
    expect(normalizeTools(null)).toEqual([]);
    expect(normalizeTools('search')).toEqual([]);
    expect(normalizeTools({ name: 'x' })).toEqual([]);
  });
});
