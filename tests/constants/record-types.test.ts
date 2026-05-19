import { describe, it, expect } from 'vitest';
import { RECORD_TYPES, labelForType } from '../../src/constants/record-types';

describe('RECORD_TYPES', () => {
  it('maps the canonical 5 record types to human labels', () => {
    expect(RECORD_TYPES['agent']).toBe('Agent');
    expect(RECORD_TYPES['mcp']).toBe('MCP Server');
    expect(RECORD_TYPES['skill']).toBe('Skill');
    expect(RECORD_TYPES['a2a']).toBe('A2A Endpoint');
    expect(RECORD_TYPES['payment']).toBe('Payment');
  });
});

describe('labelForType', () => {
  it('returns the canonical label for a known type', () => {
    expect(labelForType('agent')).toBe('Agent');
    expect(labelForType('skill')).toBe('Skill');
    expect(labelForType('mcp')).toBe('MCP Server');
    expect(labelForType('a2a')).toBe('A2A Endpoint');
    expect(labelForType('payment')).toBe('Payment');
  });

  it('echoes back an unknown type unchanged', () => {
    expect(labelForType('custom-thing')).toBe('custom-thing');
  });

  it('returns "skill" when type is undefined', () => {
    expect(labelForType(undefined)).toBe('skill');
  });

  it('returns "skill" when type is null', () => {
    expect(labelForType(null)).toBe('skill');
  });

  it('returns "skill" when type is empty string (falsy)', () => {
    // The cascade short-circuits on `if (type && ...)`, so empty string
    // skips the table and falls through to `type ?? 'skill'` which yields ''
    expect(labelForType('')).toBe('');
  });
});
