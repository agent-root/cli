import dns from 'node:dns';
import { parseTxtRecord } from '@agent-root/core';

export type ResolveResult =
  | { found: false; error: string; txtRecords?: string[] }
  | { found: true; mode: 'manifest'; manifestUrl: string; raw: string; txtRecords: string[] }
  | { found: true; mode: 'skill'; skillUrl: string; raw: string; txtRecords: string[] }
  | { found: true; mode: 'inline'; fields: Record<string, string>; raw: string; txtRecords: string[] };

export function dnsLookupTxt(hostname: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    dns.resolveTxt(hostname, (err, records) => {
      if (err) return reject(err);
      // TXT records come as arrays of chunks, join them
      resolve(records.map(chunks => chunks.join('')));
    });
  });
}

export async function resolveAgentroot(domain: string): Promise<ResolveResult> {
  const hostname = `_agentroot.${domain}`;
  let txtRecords: string[];
  try {
    txtRecords = await dnsLookupTxt(hostname);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENODATA' || e.code === 'ENOTFOUND' || e.code === 'SERVFAIL') {
      return { found: false, error: `No _agentroot TXT record found at ${hostname}` };
    }
    throw err;
  }

  const ar1 = txtRecords.find(r => r.startsWith('v=ar1'));
  if (!ar1) {
    return { found: false, error: `TXT records found at ${hostname} but none start with v=ar1`, txtRecords };
  }

  const fields = parseTxtRecord(ar1);

  // Accept both `manifest=` (canonical) and `zone=` (deprecated alias).
  // We return the raw txtRecords array so callers that need to re-parse
  // (e.g. multi-record DNS handler) don't need a second DNS round trip.
  const manifestUrl = fields.manifest ?? fields.zone;
  if (manifestUrl) {
    return { found: true, mode: 'manifest', manifestUrl, raw: ar1, txtRecords };
  } else if (fields.skill) {
    return { found: true, mode: 'skill', skillUrl: fields.skill, raw: ar1, txtRecords };
  } else if (fields.type) {
    return { found: true, mode: 'inline', fields, raw: ar1, txtRecords };
  }

  return { found: false, error: `TXT record found but missing manifest=, skill=, and type= fields: ${ar1}`, txtRecords };
}
