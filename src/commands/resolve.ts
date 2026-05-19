import pc from 'picocolors';
import { validateManifest, parseAllTxt, getHandler, type ParsedRecord } from '@agent-root/core';
import { fetchJSON } from '../services/http/fetch';
import { dnsLookupTxt, resolveAgentroot } from '../services/dns/dns-service';
import { fatal } from '../cli/fatal';
import { maybeSpinner } from '../cli/spinner';
import { formatRecord } from '../utils/format-record';
import { installSkill } from '../services/install/install-skill';
import type { JsonOut } from '../types/install';

// --- Per-record helpers using the registry ---

function summarizeForDisplay(record: ParsedRecord): string {
  try {
    return getHandler(record.type).summarize(record as never);
  } catch {
    return `${record.type}: ${record.id ?? '(unnamed)'}`;
  }
}

async function maybeAutoInstallSkill(
  domain: string,
  record: ParsedRecord,
  flags: Record<string, unknown>,
): Promise<void> {
  if (record.type !== 'skill') return;
  if (flags['noInstall']) return;

  const skillUrl = record.skill_md_url ?? record.skill_md;
  const skillId = record.id ?? domain.split('.')[0] ?? 'skill';
  if (!skillUrl) return;

  const installSpinner = maybeSpinner('Installing skill ' + skillId + '...', flags).start();
  const jsonOut: JsonOut = { status: 'success', domain, recordId: skillId, type: 'skill', installed: [], skipped: [], errors: [] };

  const recordForInstall: Record<string, unknown> = {
    type: 'skill',
    id: skillId,
    name: record.name ?? skillId,
    skill_md: skillUrl,
    _domain: domain,
  };

  try {
    await installSkill({
      domain,
      recordId: skillId,
      record: recordForInstall,
      manifest: null,
      installAll: false,
      isProject: !!flags['project'],
      flags: { ...flags, _quiet: true },
      jsonOut,
    });
  } catch (err) {
    installSpinner.error({ text: 'Install failed: ' + (err as Error).message });
    return;
  }

  if (jsonOut.errors.length > 0) {
    installSpinner.error({ text: 'Failed: ' + (jsonOut.errors[0] as Record<string, string>).error });
    return;
  }

  installSpinner.success({ text: `Installed ${pc.bold(skillId)} (${jsonOut.installed.length} tool(s))` });
  if (!flags.json) {
    for (const i of jsonOut.installed as Array<Record<string, string>>) {
      console.log(`  ${pc.green('linked')} ${pc.bold(skillId)} → ${i.path} (${i.link_type})`);
    }
  }
}

// --- Mode handlers ---

async function handleManifestMode(domain: string, manifestUrl: string, recordId: string | null, flags: Record<string, unknown>): Promise<void> {
  const spinner = maybeSpinner('Fetching manifest from ' + manifestUrl + '...', flags).start();

  let manifest: Record<string, unknown>;
  try {
    manifest = await fetchJSON<Record<string, unknown>>(manifestUrl);
  } catch (err) {
    spinner.error({ text: 'Could not fetch manifest' });
    fatal(`Could not fetch manifest at ${manifestUrl}: ${(err as Error).message}`, 'Check: ' + manifestUrl);
  }

  const records = manifest.records as Record<string, unknown>[] || [];
  spinner.success({ text: `Found ${records.length} record(s) at ${domain}` });

  const { valid, errors } = validateManifest(manifest, domain);
  if (!valid) {
    console.log(`${pc.yellow('warning')} Manifest has validation issues:`);
    for (const e of errors) console.log(`  - ${e}`);
    console.log();
  }

  if (flags.json) {
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }

  console.log(`${pc.bold(manifest.domain as string)} — ${records.length} record(s)\n`);

  const filtered = recordId ? records.filter(r => r.id === recordId) : records;
  if (recordId && filtered.length === 0) {
    fatal(`Record "${recordId}" not found. Available: ${records.map(r => r.id).join(', ')}`);
  }

  for (const r of filtered) {
    r._domain = domain;
    console.log(formatRecord(r));
  }

  const subdomains = manifest.subdomains as string[] | undefined;
  if (subdomains && subdomains.length > 0) {
    console.log(`${pc.dim(`Subdomains: ${subdomains.join(', ')}`)}\n`);
  }
}

// --- Multi-record DNS handler (the rides.com fix) ---

async function handleMultiRecordDns(domain: string, txtRecords: string[], flags: Record<string, unknown>): Promise<void> {
  const records = parseAllTxt(txtRecords, domain);

  if (records.length === 0) {
    fatal(`No v=ar1 records found at _agentroot.${domain}`);
  }

  if (flags.json) {
    console.log(JSON.stringify({ status: 'success', domain, records }, null, 2));
    return;
  }

  console.log(`${pc.bold(`_agentroot.${domain}`)} — ${records.length} record(s)\n`);

  for (const record of records) {
    console.log(`  ${pc.dim('TXT:')} ${record.raw ?? ''}`);
    console.log(`  ${summarizeForDisplay(record)}`);

    // Show structured "how to use" for discover-only types
    try {
      const handler = getHandler(record.type);
      if (!handler.capabilities.hasLocalArtifacts) {
        const instructions = handler.describe(record as never);
        console.log(`  ${pc.dim(instructions.description)}`);
      }
    } catch { /* unknown type, summarize already covered it */ }

    console.log();
  }

  // Auto-install all skill records (one per skill)
  for (const record of records) {
    await maybeAutoInstallSkill(domain, record, flags);
  }
}

// --- Entry point ---

export async function cmdResolve(positional: string[], flags: Record<string, unknown>): Promise<void> {
  if (positional.length === 0) {
    fatal('Usage: agentroot resolve <domain> [/<record-id>]');
  }

  const input = positional[0] as string;
  const slashIdx = input.indexOf('/');
  const domain = slashIdx === -1 ? input : input.slice(0, slashIdx);
  const recordId = slashIdx === -1 ? null : input.slice(slashIdx + 1);

  const spinner = maybeSpinner('Resolving _agentroot.' + domain + '...', flags).start();

  // First check manifest mode — if the domain points at a manifest URL, prefer that path
  // (manifests can hold many records of any type and have richer schemas).
  const result = await resolveAgentroot(domain);

  if (!result.found) {
    spinner.error({ text: result.error });
    fatal(result.error, 'Try: agentroot search ' + domain.split('.')[0]);
  }

  if (result.mode === 'manifest') {
    spinner.update({ text: 'Fetching manifest...' });
    await handleManifestMode(domain, result.manifestUrl, recordId, flags);
    return;
  }

  // For non-manifest modes (skill / inline / multiple), re-fetch all TXT records
  // and use the registry's parseAllTxt — fixes the multi-record bug where
  // domains publishing both a skill and a payment record (e.g. rides.com)
  // previously returned only the first.
  let txtRecords: string[];
  try {
    txtRecords = await dnsLookupTxt(`_agentroot.${domain}`);
  } catch (err) {
    spinner.error({ text: (err as Error).message });
    fatal(`DNS lookup failed: ${(err as Error).message}`);
  }

  spinner.success({ text: `Found ${txtRecords.length} TXT record(s) at _agentroot.${domain}` });
  await handleMultiRecordDns(domain, txtRecords, flags);
}
