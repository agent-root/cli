import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node:dns at the boundary. resolveTxt is the only consumer.
vi.mock('node:dns', () => {
  const resolveTxt = vi.fn();
  return { default: { resolveTxt }, resolveTxt };
});

import dns from 'node:dns';
import { dnsLookupTxt, resolveAgentroot } from '../../../src/services/dns/dns-service';

type ResolveTxtCallback = (err: NodeJS.ErrnoException | null, records: string[][]) => void;

function setTxtRecords(records: string[][]): void {
  vi.mocked(dns.resolveTxt).mockImplementation(((_host: string, cb: ResolveTxtCallback) => {
    cb(null, records);
  }) as unknown as typeof dns.resolveTxt);
}

function setTxtError(code: string): void {
  vi.mocked(dns.resolveTxt).mockImplementation(((_host: string, cb: ResolveTxtCallback) => {
    const err = new Error(code) as NodeJS.ErrnoException;
    err.code = code;
    cb(err, []);
  }) as unknown as typeof dns.resolveTxt);
}

describe('dnsLookupTxt', () => {
  beforeEach(() => {
    vi.mocked(dns.resolveTxt).mockReset();
  });

  it('joins TXT-record chunks into one string per record', async () => {
    setTxtRecords([['part1', 'part2'], ['solo']]);
    const result = await dnsLookupTxt('_agentroot.example.com');
    expect(result).toEqual(['part1part2', 'solo']);
  });

  it('rejects when dns.resolveTxt errors', async () => {
    setTxtError('ENOTFOUND');
    await expect(dnsLookupTxt('_agentroot.example.com')).rejects.toThrow();
  });
});

describe('resolveAgentroot', () => {
  beforeEach(() => {
    vi.mocked(dns.resolveTxt).mockReset();
  });

  it('returns found: true mode=manifest for a valid manifest= TXT', async () => {
    setTxtRecords([['v=ar1 manifest=https://example.com/.well-known/agentroot.json']]);
    const r = await resolveAgentroot('example.com');
    expect(r.found).toBe(true);
    if (r.found && r.mode === 'manifest') {
      expect(r.manifestUrl).toBe('https://example.com/.well-known/agentroot.json');
      expect(r.txtRecords).toHaveLength(1);
    }
  });

  it('accepts zone= as a deprecated alias for manifest=', async () => {
    setTxtRecords([['v=ar1 zone=https://example.com/agentroot.json']]);
    const r = await resolveAgentroot('example.com');
    expect(r.found).toBe(true);
    if (r.found && r.mode === 'manifest') {
      expect(r.manifestUrl).toBe('https://example.com/agentroot.json');
    }
  });

  it('returns mode=skill for a skill= TXT', async () => {
    setTxtRecords([['v=ar1 skill=https://example.com/SKILL.md']]);
    const r = await resolveAgentroot('example.com');
    expect(r.found).toBe(true);
    if (r.found && r.mode === 'skill') {
      expect(r.skillUrl).toBe('https://example.com/SKILL.md');
    }
  });

  it('returns mode=inline for a type= TXT', async () => {
    setTxtRecords([['v=ar1 type=agent endpoint=https://example.com/agent']]);
    const r = await resolveAgentroot('example.com');
    expect(r.found).toBe(true);
    if (r.found && r.mode === 'inline') {
      expect(r.fields['type']).toBe('agent');
    }
  });

  it('returns found:false on ENODATA', async () => {
    setTxtError('ENODATA');
    const r = await resolveAgentroot('example.com');
    expect(r.found).toBe(false);
    if (!r.found) {
      expect(r.error).toContain('_agentroot.example.com');
      expect(r.error).toContain('No');
    }
  });

  it('returns found:false on ENOTFOUND', async () => {
    setTxtError('ENOTFOUND');
    const r = await resolveAgentroot('example.com');
    expect(r.found).toBe(false);
  });

  it('returns found:false on SERVFAIL', async () => {
    setTxtError('SERVFAIL');
    const r = await resolveAgentroot('example.com');
    expect(r.found).toBe(false);
  });

  it('rethrows on unexpected DNS errors', async () => {
    setTxtError('EREFUSED');
    await expect(resolveAgentroot('example.com')).rejects.toThrow('EREFUSED');
  });

  it('returns found:false when TXT records exist but none start with v=ar1', async () => {
    setTxtRecords([['v=spf1 -all'], ['some-other-thing']]);
    const r = await resolveAgentroot('example.com');
    expect(r.found).toBe(false);
    if (!r.found) {
      expect(r.error).toContain('none start with v=ar1');
      expect(r.txtRecords).toHaveLength(2);
    }
  });

  it('returns found:false when v=ar1 record has no manifest/skill/type', async () => {
    setTxtRecords([['v=ar1 other=field']]);
    const r = await resolveAgentroot('example.com');
    expect(r.found).toBe(false);
    if (!r.found) {
      expect(r.error).toContain('missing manifest=, skill=, and type=');
    }
  });

  it('filters out non-ar1 TXT records when finding the ar1 one', async () => {
    setTxtRecords([
      ['v=spf1 -all'],
      ['v=ar1 manifest=https://example.com/agentroot.json'],
    ]);
    const r = await resolveAgentroot('example.com');
    expect(r.found).toBe(true);
  });
});
