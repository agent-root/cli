import { describe, expect, it } from 'vitest';
import { clampLimit, clampPage, recordToSearchResult } from '../../src/commands/search';

describe('clampLimit', () => {
  it('returns the default for undefined input', () => {
    expect(clampLimit(undefined)).toBe(20);
  });

  it('returns the default for non-numeric strings', () => {
    expect(clampLimit('not-a-number')).toBe(20);
  });

  it('coerces a numeric string into a number', () => {
    expect(clampLimit('15')).toBe(15);
  });

  it('clamps below 1 to the default (1 floor)', () => {
    expect(clampLimit(0)).toBe(20);
    expect(clampLimit(-5)).toBe(20);
  });

  it('caps values above 100 at the API maximum', () => {
    expect(clampLimit(500)).toBe(100);
    expect(clampLimit('1000')).toBe(100);
  });

  it('floors non-integer values rather than rounding', () => {
    expect(clampLimit(42.9)).toBe(42);
  });

  it('accepts numbers in the valid range unchanged', () => {
    expect(clampLimit(50)).toBe(50);
    expect(clampLimit(100)).toBe(100);
  });
});

describe('clampPage', () => {
  it('defaults to 1 for undefined input', () => {
    expect(clampPage(undefined)).toBe(1);
  });

  it('defaults to 1 for non-numeric strings', () => {
    expect(clampPage('asdf')).toBe(1);
  });

  it('coerces numeric strings', () => {
    expect(clampPage('7')).toBe(7);
  });

  it('floors values below 1 to 1', () => {
    expect(clampPage(0)).toBe(1);
    expect(clampPage(-3)).toBe(1);
  });

  it('floors non-integer values', () => {
    expect(clampPage(3.8)).toBe(3);
  });

  it('accepts large valid page numbers', () => {
    expect(clampPage(143)).toBe(143);
  });
});

describe('recordToSearchResult', () => {
  it('maps the canonical /api/records row shape onto SearchResult', () => {
    const row = {
      id: 17, manifest_id: 6,
      domain: 'doma.xyz', record_id: 'doma-protocol',
      type: 'skill', name: 'Doma Protocol', description: 'Trade tokens, ...',
      endpoint: null,
      raw_record: { skill_md: 'https://doma.xyz/.agents/skills/doma-protocol/SKILL.md' },
      auth: null, status: 'active',
      manifest_domain: 'doma.xyz', manifest_status: 'active',
    };
    const r = recordToSearchResult(row);
    expect(r.domain).toBe('doma.xyz');
    expect(r.type).toBe('skill');
    expect(r.id).toBe('doma-protocol');
    expect(r.record_id).toBe('doma-protocol');
    expect(r.name).toBe('Doma Protocol');
    expect(r.address).toBe('doma.xyz/doma-protocol');
    expect(r.verified).toBe(true);
    expect(r.skill_md).toBe('https://doma.xyz/.agents/skills/doma-protocol/SKILL.md');
  });

  it('marks results unverified when manifest_status is not active', () => {
    const r = recordToSearchResult({
      domain: 'foo.io', record_id: 'x', type: 'skill', name: 'X',
      status: 'active', manifest_status: 'pending',
    });
    expect(r.verified).toBe(false);
  });

  it('falls back to record_id when name is missing', () => {
    const r = recordToSearchResult({ domain: 'foo.io', record_id: 'rec-1', type: 'agent' });
    expect(r.name).toBe('rec-1');
  });

  it('normalizes capabilities from a JSON array', () => {
    const r = recordToSearchResult({
      domain: 'foo.io', record_id: 'x', type: 'mcp',
      capabilities: ['cap-a', 'cap-b'],
    });
    expect(r.capabilities).toEqual(['cap-a', 'cap-b']);
  });

  it('normalizes capabilities from a comma-separated string', () => {
    const r = recordToSearchResult({
      domain: 'foo.io', record_id: 'x', type: 'mcp',
      capabilities: 'cap-a, cap-b, cap-c',
    });
    expect(r.capabilities).toEqual(['cap-a', 'cap-b', 'cap-c']);
  });

  it('uses raw_record.endpoint when the top-level endpoint is null', () => {
    const r = recordToSearchResult({
      domain: 'foo.io', record_id: 'mcp1', type: 'mcp',
      endpoint: null, raw_record: { endpoint: 'https://foo.io/mcp' },
    });
    expect(r.endpoint).toBe('https://foo.io/mcp');
  });

  it('defaults type to skill when missing (legacy rows)', () => {
    const r = recordToSearchResult({ domain: 'foo.io', record_id: 'x' });
    expect(r.type).toBe('skill');
  });
});
