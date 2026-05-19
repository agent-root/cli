import pc from 'picocolors';
import { fetchJSON } from '../services/http/fetch';
import { getApiBase } from '../services/config/config-service';
import { resolveAgentroot } from '../services/dns/dns-service';
import { fatal } from '../cli/fatal';
import { maybeSpinner } from '../cli/spinner';
import { RECORD_TYPES } from '../constants/record-types';
import { searchWithFallback, selectResult, promptSearch, type SearchResult } from './search';
import { installSkill } from './install-helpers';

export interface SkillMeta {
  id: string;
  name: string;
  description: string;
  url: string;
  domain: string;
}

export interface JsonOut {
  status: string;
  domain: string;
  recordId: string | null;
  type: string | null;
  installed: Array<Record<string, unknown>>;
  skipped: Array<Record<string, unknown>>;
  errors: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export function installMcp(
  domain: string,
  recordId: string | null,
  record: Record<string, unknown>,
  flags: Record<string, unknown>,
  jsonOut: JsonOut,
): void {
  const transport = (record['transport'] as string) || 'sse';
  const endpoint = record['endpoint'] as string | undefined;
  const mcpName = `${domain}/${recordId}`;
  let configObject: Record<string, unknown> | null = null;

  if (transport === 'stdio' && record['install']) {
    const inst = record['install'] as Record<string, unknown>;
    const cmd = (inst['command'] as string) || `npx ${inst['package'] as string}`;
    const parts = cmd.split(' ');
    configObject = { [mcpName]: { command: parts[0], args: parts.slice(1) } };
  } else if (endpoint) {
    configObject = { [mcpName]: { url: endpoint } };
  }

  jsonOut.type = 'mcp';
  jsonOut.installed.push({
    tool: 'config-display',
    name: record['name'] || recordId,
    config: configObject,
    transport,
    endpoint,
    auth: record['auth'] || 'none',
  });

  if (flags && flags['json']) return;

  const displayName = pc.bold((record['name'] || recordId) as string);
  console.log(`${pc.green('found')} MCP server: ${displayName}\n`);
  if (record['description']) console.log(`  ${record['description'] as string}\n`);

  if (Array.isArray(record['tools']) && record['tools'].length > 0) {
    console.log(`  ${pc.dim('Tools:')}`);
    for (const t of record['tools'] as Array<{ name: string; description?: string }>) {
      console.log(`    ${pc.cyan(t.name)}${t.description ? ` — ${pc.dim(t.description)}` : ''}`);
    }
    console.log();
  }

  if (configObject) {
    console.log(`${pc.bold('Add to your MCP config:')}\n`);
    console.log(JSON.stringify(configObject, null, 2));
  }

  console.log(`\n${pc.dim('For Claude Code:  Add to .claude/settings.json under "mcpServers"')}`);
  console.log(`${pc.dim('For Cursor:       Add to .cursor/mcp.json under "mcpServers"')}`);
  if (record['auth'] && record['auth'] !== 'none') {
    const authLabel = pc.bold(record['auth'] as string);
    console.log(`\n${pc.yellow('note')} This MCP server requires auth: ${authLabel}`);
    if (record['docs']) console.log(`  See: ${record['docs'] as string}`);
  }
}

export function installAgent(
  domain: string,
  recordId: string | null,
  record: Record<string, unknown>,
  flags: Record<string, unknown>,
  jsonOut: JsonOut,
): void {
  const typeLabel = RECORD_TYPES[record['type'] as string] || record['type'] as string;
  jsonOut.type = record['type'] as string;
  jsonOut.installed.push({
    name: record['name'] || recordId,
    endpoint: record['endpoint'],
    protocol: record['protocol'] || 'a2a',
    capabilities: record['capabilities'] || [],
    auth: record['auth'] || 'none',
  });

  if (flags && flags['json']) return;

  const displayName = pc.bold((record['name'] || recordId) as string);
  console.log(`${pc.green('found')} ${typeLabel}: ${displayName}\n`);
  if (record['description']) console.log(`  ${record['description'] as string}\n`);
  if (record['endpoint']) console.log(`  ${pc.dim('endpoint:')} ${record['endpoint'] as string}`);
  if (record['protocol']) console.log(`  ${pc.dim('protocol:')} ${record['protocol'] as string}`);
  if (record['capabilities']) {
    const caps = (record['capabilities'] as string[]).join(', ');
    console.log(`  ${pc.dim('capabilities:')} ${caps}`);
  }
  if (record['auth']) console.log(`  ${pc.dim('auth:')} ${record['auth'] as string}`);
  if (record['docs']) console.log(`  ${pc.dim('docs:')} ${record['docs'] as string}`);
  console.log();
  const protoLabel = record['protocol'] || 'a2a';
  console.log(pc.dim(`Agents are accessed via their endpoint. Use the protocol (${protoLabel}) to connect.`));
}

export async function cmdInstall(positional: string[], flags: Record<string, unknown>): Promise<void> {
  if (positional.length === 0) {
    if (process.stdout.isTTY && !flags['json']) {
      await promptSearch(flags);
      return;
    }
    fatal('Usage: agentroot install <domain>/<record-id> [--tool claude|codex|gemini|cursor|agents] [--project]');
  }

  const input = positional[0] as string;
  const isProject = !!flags['project'];
  const installAll = !!flags['all'];

  const slashIdx = input.indexOf('/');
  if (slashIdx === -1 && !installAll) {
    fatal(
      'Expected format: <domain>/<record-id> or <domain> --all',
      'Example: agentroot install stripe.com/payments --tool claude',
    );
  }

  const domain = installAll ? input : input.slice(0, slashIdx);
  const recordId = installAll ? null : input.slice(slashIdx + 1);

  if (!domain) fatal('Missing domain', 'Example: agentroot install stripe.com/payments');
  if (!installAll && !recordId) fatal('Missing record ID', 'Example: agentroot install stripe.com/payments');

  // Path traversal protection — reject record IDs that could write outside skill directory
  if (recordId && (recordId.includes('..') || recordId.includes('/') || recordId.includes('\\'))) {
    fatal(
      'Invalid record ID — must not contain path separators',
      'Record IDs are simple identifiers like "payments" or "db-tools"',
    );
  }

  let record: Record<string, unknown> | null = null;
  let manifest: Record<string, unknown> | null = null;
  const spinner = maybeSpinner('Resolving ' + domain + '...', flags).start();

  // Always try DNS resolution first — both for single install and --all
  try {
    const result = await resolveAgentroot(domain);
    if (result.found && result.mode === 'manifest') {
      spinner.update({ text: 'Fetching manifest...' });
      manifest = await fetchJSON<Record<string, unknown>>(result.manifestUrl);
      if (manifest['records'] && recordId) {
        record = (manifest['records'] as Array<Record<string, unknown>>).find(r => r['id'] === recordId) || null;
      }
    } else if (result.found && result.mode === 'skill') {
      record = { type: 'skill', id: domain.split('.')[0], skill_url: result.skillUrl } as Record<string, unknown>;
    } else if (result.found && result.mode === 'inline') {
      record = result.fields as unknown as Record<string, unknown>;
    }
  } catch {
    // DNS resolution is best-effort — domain might have no _agentroot
    // TXT record, DNS might be flaky, or the manifest URL might 404.
    // Swallowing so we proceed to the registry fallback below.
  }

  // Fallback to registry if DNS didn't find anything
  if (!record && !manifest) {
    try {
      spinner.update({ text: 'Fetching manifest from registry...' });
      const manifestUrl = `${getApiBase()}/api/manifests/${encodeURIComponent(domain)}`;
      const manifestData = await fetchJSON<{ manifest?: Record<string, unknown> }>(manifestUrl);
      const z = manifestData.manifest || manifestData as Record<string, unknown>;
      const zRec = z as Record<string, unknown>;
      if (zRec['records'] || zRec['raw_manifest']) {
        manifest = (zRec['raw_manifest'] || zRec) as Record<string, unknown>;
        if (manifest['records'] && recordId) {
          const records = manifest['records'] as Array<Record<string, unknown>>;
          record = records.find(r => r['id'] === recordId) || null;
        }
      }
    } catch {
      // Registry is an optional fallback — DNS resolution above is the
      // primary path. If both DNS and the registry have nothing, the
      // type check below will fatal with a clear message.
    }
  }

  const recordType = record ? record['type'] as string : ((flags['type'] as string) || null);
  const jsonOut: JsonOut = { status: 'success', domain, recordId, type: null, installed: [], skipped: [], errors: [] };

  if (recordType === 'mcp') {
    spinner.success({ text: 'Resolved ' + ((record ? (record['name'] || recordId) : domain) as string) });
    installMcp(domain, recordId, record || {}, flags, jsonOut);
    if (flags['json']) { console.log(JSON.stringify(jsonOut, null, 2)); }
    return;
  }

  if (recordType === 'agent' || recordType === 'a2a') {
    spinner.success({ text: 'Resolved ' + ((record ? (record['name'] || recordId) : domain) as string) });
    installAgent(domain, recordId, record || {}, flags, jsonOut);
    if (flags['json']) { console.log(JSON.stringify(jsonOut, null, 2)); }
    return;
  }

  spinner.success({ text: 'Resolved ' + ((record ? (record['name'] || recordId) : domain) as string) });
  await installSkill({ domain, recordId, record, manifest, installAll, isProject, flags, jsonOut });
  if (flags['json']) { console.log(JSON.stringify(jsonOut, null, 2)); }
}

export { searchWithFallback, selectResult };
