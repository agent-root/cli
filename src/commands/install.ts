import { colors } from '../cli/colors';
import { fetchJSON } from '../services/http/fetch';
import { getApiBase } from '../services/config/config-service';
import { resolveAgentroot } from '../services/dns/dns-service';
import { fatal } from '../cli/fatal';
import { maybeSpinner } from '../cli/spinner';
import { RECORD_TYPES } from '../constants/record-types';
import { searchWithFallback, selectResult, promptSearch, type SearchResult } from './search';
import { installSkill } from '../services/install/install-skill';
import type { JsonOut } from '../types/install';

// Re-exported for callers that still import these from this module.
export type { SkillMeta, JsonOut } from '../types/install';

// --- public: per-type installers ---

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
  const configObject = buildMcpConfigObject(transport, record, endpoint, mcpName);

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

  const displayName = colors.bold((record['name'] || recordId) as string);
  console.log(`${colors.green('found')} MCP server: ${displayName}\n`);
  if (record['description']) console.log(`  ${record['description'] as string}\n`);

  if (Array.isArray(record['tools']) && record['tools'].length > 0) {
    console.log(`  ${colors.dim('Tools:')}`);
    for (const t of record['tools'] as Array<{ name: string; description?: string }>) {
      console.log(`    ${colors.cyan(t.name)}${t.description ? `: ${colors.dim(t.description)}` : ''}`);
    }
    console.log();
  }

  if (configObject) {
    console.log(`${colors.bold('Add to your MCP config:')}\n`);
    console.log(JSON.stringify(configObject, null, 2));
  }

  console.log(`\n${colors.dim('For Claude Code:  Add to .claude/settings.json under "mcpServers"')}`);
  console.log(`${colors.dim('For Cursor:       Add to .cursor/mcp.json under "mcpServers"')}`);
  if (record['auth'] && record['auth'] !== 'none') {
    const authLabel = colors.bold(record['auth'] as string);
    console.log(`\n${colors.yellow('note')} This MCP server requires auth: ${authLabel}`);
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
  const recordTypeStr = record['type'] as string;
  const typeLabel = RECORD_TYPES[recordTypeStr] || recordTypeStr;
  jsonOut.type = recordTypeStr;
  jsonOut.installed.push({
    name: record['name'] || recordId,
    endpoint: record['endpoint'],
    protocol: record['protocol'] || 'a2a',
    capabilities: record['capabilities'] || [],
    auth: record['auth'] || 'none',
  });

  if (flags && flags['json']) return;

  const displayName = colors.bold((record['name'] || recordId) as string);
  console.log(`${colors.green('found')} ${typeLabel}: ${displayName}\n`);
  if (record['description']) console.log(`  ${record['description'] as string}\n`);
  if (record['endpoint']) console.log(`  ${colors.dim('endpoint:')} ${record['endpoint'] as string}`);
  if (record['protocol']) console.log(`  ${colors.dim('protocol:')} ${record['protocol'] as string}`);
  if (record['capabilities']) {
    const caps = (record['capabilities'] as string[]).join(', ');
    console.log(`  ${colors.dim('capabilities:')} ${caps}`);
  }
  if (record['auth']) console.log(`  ${colors.dim('auth:')} ${record['auth'] as string}`);
  if (record['docs']) console.log(`  ${colors.dim('docs:')} ${record['docs'] as string}`);
  console.log();
  const protoLabel = record['protocol'] || 'a2a';
  console.log(colors.dim(`Agents are accessed via their endpoint. Use the protocol (${protoLabel}) to connect.`));
}

// --- public: command entry point ---

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
      'Example: agentroot install doma.xyz/doma-protocol --tool claude',
    );
  }

  const domain = installAll ? input : input.slice(0, slashIdx);
  const recordId = installAll ? null : input.slice(slashIdx + 1);

  if (!domain) fatal('Missing domain', 'Example: agentroot install doma.xyz/doma-protocol');
  if (!installAll && !recordId) fatal('Missing record ID', 'Example: agentroot install doma.xyz/doma-protocol');

  // Path traversal protection: reject record IDs that could write outside skill directory
  if (recordId && (recordId.includes('..') || recordId.includes('/') || recordId.includes('\\'))) {
    fatal(
      'Invalid record ID. Must not contain path separators.',
      'Record IDs are simple identifiers like "payments" or "db-tools"',
    );
  }

  let record: Record<string, unknown> | null = null;
  let manifest: Record<string, unknown> | null = null;
  const spinner = maybeSpinner('Resolving ' + domain + '...', flags).start();

  // Always try DNS resolution first, both for single install and --all
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
    // DNS resolution is best-effort, domain might have no _agentroot
    // TXT record, DNS might be flaky, or the manifest URL might 404.
    // Swallowing so we proceed to the registry fallback below.
  }

  // Fallback to registry if DNS didn't find anything
  if (!record && !manifest) {
    try {
      spinner.update({ text: 'Fetching manifest from registry...' });
      const manifestUrl = `${getApiBase()}/api/manifests/${encodeURIComponent(domain)}`;
      const manifestData = await fetchJSON<{ manifest?: Record<string, unknown> }>(manifestUrl);
      // Some API revisions wrap the manifest in a `manifest` envelope; older
      // ones return the bare shape. `??` (not `||`) so an explicit `null`
      // wrapper still falls through to the bare envelope.
      const envelope = manifestData.manifest ?? (manifestData as Record<string, unknown>);
      if (envelope['records'] || envelope['raw_manifest']) {
        manifest = (envelope['raw_manifest'] || envelope) as Record<string, unknown>;
        if (manifest['records'] && recordId) {
          const records = manifest['records'] as Array<Record<string, unknown>>;
          record = records.find(r => r['id'] === recordId) || null;
        }
      }
    } catch {
      // Registry is an optional fallback, DNS resolution above is the
      // primary path. If both DNS and the registry have nothing, the
      // type check below will fatal with a clear message.
    }
  }

  const recordType: string | null =
    (record?.['type'] as string | undefined) ?? (flags['type'] as string | undefined) ?? null;
  const jsonOut: JsonOut = { status: 'success', domain, recordId, type: null, installed: [], skipped: [], errors: [] };

  // Shared `Resolved <X>` label, same source-of-truth for every branch.
  const resolvedLabel = (record ? (record['name'] || recordId) : domain) as string;
  spinner.success({ text: 'Resolved ' + resolvedLabel });

  // Dispatch on record type. Skill is the implicit default, anything that
  // isn't explicitly mcp/agent/a2a falls through to `installSkill`.
  const handler = TYPE_HANDLERS[recordType ?? ''] ?? defaultSkillHandler;
  await handler({ domain, recordId, record, manifest, installAll, isProject, flags, jsonOut });

  if (flags['json']) console.log(JSON.stringify(jsonOut, null, 2));
}

export { searchWithFallback, selectResult };

// --- private helpers ---

interface DispatchContext {
  domain: string;
  recordId: string | null;
  record: Record<string, unknown> | null;
  manifest: Record<string, unknown> | null;
  installAll: boolean;
  isProject: boolean;
  flags: Record<string, unknown>;
  jsonOut: JsonOut;
}

type TypeHandler = (ctx: DispatchContext) => Promise<void> | void;

const TYPE_HANDLERS: Record<string, TypeHandler> = {
  mcp: ({ domain, recordId, record, flags, jsonOut }) => {
    installMcp(domain, recordId, record || {}, flags, jsonOut);
  },
  agent: ({ domain, recordId, record, flags, jsonOut }) => {
    installAgent(domain, recordId, record || {}, flags, jsonOut);
  },
  a2a: ({ domain, recordId, record, flags, jsonOut }) => {
    installAgent(domain, recordId, record || {}, flags, jsonOut);
  },
};

const defaultSkillHandler: TypeHandler = async ({
  domain, recordId, record, manifest, installAll, isProject, flags, jsonOut,
}) => {
  await installSkill({ domain, recordId, record, manifest, installAll, isProject, flags, jsonOut });
};

/**
 * Build the MCP client config object for a record. Two shapes:
 *   - stdio + `install` block → `{ command, args }`
 *   - any other transport with an `endpoint` → `{ url }`
 *
 * Returns `null` if neither shape can be produced, callers display nothing
 * in that case, matching prior behavior.
 */
function buildMcpConfigObject(
  transport: string,
  record: Record<string, unknown>,
  endpoint: string | undefined,
  mcpName: string,
): Record<string, unknown> | null {
  if (transport === 'stdio' && record['install']) {
    const inst = record['install'] as Record<string, unknown>;
    const cmd = (inst['command'] as string) || `npx ${inst['package'] as string}`;
    const parts = cmd.split(' ');
    return { [mcpName]: { command: parts[0], args: parts.slice(1) } };
  }
  if (endpoint) {
    return { [mcpName]: { url: endpoint } };
  }
  return null;
}
