import fs from 'node:fs';
import { colors } from '../cli/colors';
import { validateManifest, MANIFEST_PATH } from '@agent-root/core';
import { fatal } from '../cli/fatal';
import { EXIT } from '../cli/exit-codes';
import { RECORD_TYPES } from '../constants/record-types';

export async function cmdValidate(positional: string[], flags: Record<string, unknown>): Promise<void> {
  const filePath = positional[0] || MANIFEST_PATH;

  if (!fs.existsSync(filePath)) {
    // The user pointed validate at a path that doesn't exist — NOINPUT (66)
    // is the canonical sysexits answer for "cannot find input file".
    fatal(`File not found: ${filePath}`, EXIT.NOINPUT);
  }

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    // EACCES → NOPERM (77), everything else → NOINPUT (66). Keeps the rule
    // "can't read the file" but distinguishes the cause for scripts.
    const code = (e.code === 'EACCES' || e.code === 'EPERM') ? EXIT.NOPERM : EXIT.NOINPUT;
    fatal(`Cannot read file: ${(err as Error).message}`, code);
  }

  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    // Malformed JSON is a protocol-level failure (the file claims to be a
    // manifest but isn't parseable) — sysexits PROTOCOL (76) covers it.
    fatal(`Invalid JSON: ${(err as Error).message}`, EXIT.PROTOCOL);
  }

  const { valid, errors } = validateManifest(manifest);

  if (valid) {
    if (flags['json']) {
      console.log(JSON.stringify({ valid: true, file: filePath, manifest }, null, 2));
      return;
    }
    console.log(`${colors.green('valid')} ${filePath}\n`);
    console.log(`  domain:  ${manifest.domain as string}`);
    const records = manifest.records as Array<Record<string, unknown>>;
    console.log(`  records: ${records.length}`);
    const types: Record<string, number> = {};
    for (const r of records) {
      const t = r.type as string;
      types[t] = (types[t] || 0) + 1;
    }
    for (const [type, count] of Object.entries(types)) {
      const label = RECORD_TYPES[type] || type;
      console.log(`    ${count} ${label}${count > 1 ? 's' : ''}`);
    }
    const subdomains = manifest.subdomains as string[] | undefined;
    if (subdomains) console.log(`  subdomains: ${subdomains.join(', ')}`);
    console.log();
  } else {
    // Validation failure → PROTOCOL (76). The file is well-formed but doesn't
    // satisfy the protocol contract. Route through fatal() so --json mode
    // gets the standard error envelope on stdout.
    const hint = errors.length > 0 ? errors[0] : 'See: https://agentroot.io/docs/protocol';
    fatal(`Manifest validation failed for ${filePath}: ${errors.length} error(s)`, hint, EXIT.PROTOCOL);
  }
}
