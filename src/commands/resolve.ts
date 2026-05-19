import { colors } from '../cli/colors';
import { validateManifest, parseAllTxt, getHandler, type ParsedRecord } from '@agent-root/core';
import { fetchJSON } from '../services/http/fetch';
import { resolveAgentroot } from '../services/dns/dns-service';
import { fatal } from '../cli/fatal';
import { maybeSpinner } from '../cli/spinner';
import { formatRecord } from '../utils/format-record';
import { installSkill } from '../services/install/install-skill';
import { PROTOCOL_VERSION, txtHostFor } from '../constants/protocol';
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

  installSpinner.success({ text: `Installed ${colors.bold(skillId)} (${jsonOut.installed.length} tool(s))` });
  if (!flags.json) {
    for (const i of jsonOut.installed as Array<Record<string, string>>) {
      console.log(`  ${colors.green('linked')} ${colors.bold(skillId)} → ${i.path} (${i.link_type})`);
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
    console.log(`${colors.yellow('warning')} Manifest has validation issues:`);
    for (const e of errors) console.log(`  - ${e}`);
    console.log();
  }

  if (flags.json) {
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }

  console.log(`${colors.bold(manifest.domain as string)}: ${records.length} record(s)\n`);

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
    console.log(`${colors.dim(`Subdomains: ${subdomains.join(', ')}`)}\n`);
  }
}

// --- Multi-record DNS handler (the rides.com fix) ---

async function handleMultiRecordDns(domain: string, txtRecords: string[], flags: Record<string, unknown>): Promise<void> {
  const records = parseAllTxt(txtRecords, domain);

  if (records.length === 0) {
    fatal(`No ${PROTOCOL_VERSION} records found at ${txtHostFor(domain)}`);
  }

  if (flags.json) {
    console.log(JSON.stringify({ status: 'success', domain, records }, null, 2));
    return;
  }

  console.log(`${colors.bold(txtHostFor(domain))}: ${records.length} record(s)\n`);

  for (const record of records) {
    console.log(`  ${colors.dim('TXT:')} ${record.raw ?? ''}`);
    console.log(`  ${summarizeForDisplay(record)}`);

    // Show structured "how to use" for discover-only types
    try {
      const handler = getHandler(record.type);
      if (!handler.capabilities.hasLocalArtifacts) {
        const instructions = handler.describe(record as never);
        console.log(`  ${colors.dim(instructions.description)}`);
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

  const spinner = maybeSpinner('Resolving ' + txtHostFor(domain) + '...', flags).start();

  // First check manifest mode, if the domain points at a manifest URL, prefer that path
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

  // For non-manifest modes (skill / inline / multiple), reuse the TXT records
  // already fetched by resolveAgentroot, the previous code did a second
  // identical DNS lookup here, which added one full round-trip to every
  // non-manifest resolve. parseAllTxt then fixes the multi-record bug where
  // domains publishing both a skill and a payment record (e.g. rides.com)
  // previously returned only the first.
  const txtRecords = result.txtRecords;
  spinner.success({ text: `Found ${txtRecords.length} TXT record(s) at ${txtHostFor(domain)}` });
  await handleMultiRecordDns(domain, txtRecords, flags);
}
