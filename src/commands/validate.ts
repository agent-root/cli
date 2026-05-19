import fs from 'node:fs';
import { colors } from '../cli/colors';
import { validateManifest, MANIFEST_PATH } from '@agent-root/core';
import { fatal } from '../cli/fatal';
import { RECORD_TYPES } from '../constants/record-types';

export async function cmdValidate(positional: string[], _flags: Record<string, unknown>): Promise<void> {
  const filePath = positional[0] || MANIFEST_PATH;

  if (!fs.existsSync(filePath)) {
    fatal(`File not found: ${filePath}`);
  }

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    fatal(`Cannot read file: ${(err as Error).message}`);
  }

  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    fatal(`Invalid JSON: ${(err as Error).message}`);
  }

  const { valid, errors } = validateManifest(manifest);

  if (valid) {
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
    console.log(`${colors.red('invalid')} ${filePath}\n`);
    for (const e of errors) {
      console.log(`  ${colors.red('-')} ${e}`);
    }
    console.log();
    process.exit(1);
  }
}
