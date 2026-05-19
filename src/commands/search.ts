import { colors } from '../cli/colors';
import { fetchJSON } from '../services/http/fetch';
import { getApiBase } from '../services/config/config-service';
import { fatal } from '../cli/fatal';
import { maybeSpinner } from '../cli/spinner';
import { note } from '../cli/streams';
import { confirmAction } from '../cli/confirm';
import { RECORD_TYPES } from '../constants/record-types';

/**
 * Pagination bounds for `/api/records`. The registry caps `limit` at 100 and
 * returns 20 by default. Mirror those values client-side so users get a
 * predictable experience whether they pass `--limit` or not.
 */
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * `--all` safety cap. Stops a runaway loop from pulling every record in the
 * registry (currently ~3k for some queries) if a script forgets `--type` or
 * passes a too-broad term like a single letter.
 */
const ALL_MODE_HARD_CAP = 1000;

/**
 * When the user types a bare keyword without a dot (e.g. `agentroot search billing`),
 * we try treating it as a domain by appending common TLDs in priority order.
 * `.io` first because most AI-native domains live there, `.com` as final fallback.
 */
const BARE_KEYWORD_TLDS: readonly string[] = ['.io', '.com'];

export interface SearchResult {
  domain: string;
  type: string;
  id?: string;
  record_id?: string;
  name?: string;
  description?: string;
  address?: string;
  verified?: boolean;
  skill_md?: string | null;
  endpoint?: string | null;
  transport?: string | null;
  index?: string | null;
  capabilities?: string[] | null;
}

export interface SearchEnvelope {
  results: SearchResult[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

interface RecordsApiRow {
  id?: number;
  manifest_id?: number;
  domain?: string;
  record_id?: string;
  type?: string;
  name?: string | null;
  description?: string | null;
  endpoint?: string | null;
  raw_record?: Record<string, unknown> | null;
  capabilities?: unknown;
  transport?: string | null;
  status?: string;
  manifest_status?: string;
}

interface RecordsApiResponse {
  records?: RecordsApiRow[];
  total?: number;
  page?: number;
  pages?: number;
}

type ManifestRecord = {
  record_id?: unknown;
  id?: unknown;
  type?: unknown;
  name?: unknown;
  description?: unknown;
  endpoint?: unknown;
  transport?: unknown;
  raw_record?: Record<string, unknown>;
};

type ManifestData = {
  domain?: string;
  status?: string;
  records?: ManifestRecord[];
};

export function clampLimit(value: unknown): number {
  const n = typeof value === 'string' ? Number.parseInt(value, 10) : typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.floor(n)), MAX_LIMIT);
}

export function clampPage(value: unknown): number {
  const n = typeof value === 'string' ? Number.parseInt(value, 10) : typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

/**
 * Map a `/api/records` row onto the existing `SearchResult` shape so the
 * downstream display + install flows do not have to change.
 */
export function recordToSearchResult(row: RecordsApiRow): SearchResult {
  const domain = String(row.domain ?? '');
  const recordId = String(row.record_id ?? '');
  const raw = row.raw_record ?? {};
  // capabilities is sometimes a JSON array, sometimes a string, sometimes null,
  // normalize to string[] | null so display + JSON consumers see one shape.
  let caps: string[] | null = null;
  const capSource = row.capabilities ?? raw['capabilities'];
  if (Array.isArray(capSource)) caps = capSource.map(c => String(c));
  else if (typeof capSource === 'string' && capSource.length > 0) {
    caps = capSource.split(',').map(s => s.trim()).filter(Boolean);
  }
  return {
    domain,
    type: String(row.type ?? 'skill'),
    id: recordId,
    record_id: recordId,
    name: row.name ?? recordId,
    description: row.description ?? '',
    address: `${domain}/${recordId}`,
    verified: (row.status === 'active') && (row.manifest_status === 'active' || row.manifest_status === undefined),
    skill_md: (raw['skill_md'] ?? null) as string | null,
    endpoint: row.endpoint ?? (raw['endpoint'] as string | null) ?? null,
    transport: row.transport ?? (raw['transport'] as string | null) ?? null,
    index: (raw['index'] ?? null) as string | null,
    capabilities: caps,
  };
}

interface FetchRecordsPageOpts {
  query: string;
  typeFilter: string;
  page: number;
  limit: number;
}

async function fetchRecordsPage(opts: FetchRecordsPageOpts): Promise<RecordsApiResponse> {
  const params = new URLSearchParams({ q: opts.query, page: String(opts.page), limit: String(opts.limit) });
  if (opts.typeFilter) params.set('type', opts.typeFilter);
  return fetchJSON<RecordsApiResponse>(`${getApiBase()}/api/records?${params.toString()}`);
}

/**
 * Primary search path, queries `/api/records` (paginated multi-type registry
 * search). Returns a full envelope so callers can render pagination footers
 * and so `--json` consumers see total/page/pages.
 *
 * Pre-refactor this called `/api/discover` and looked for `data.results`, a
 * field that does not exist in the actual response shape. That bug silently
 * dropped every agent/MCP/A2A hit, the fallback to `/api/find-skills`
 * accidentally hid it for skill queries.
 */
export async function searchRecords(query: string, typeFilter: string, page: number, limit: number): Promise<SearchEnvelope> {
  const data = await fetchRecordsPage({ query, typeFilter, page, limit });
  const rows = Array.isArray(data.records) ? data.records : [];
  return {
    results: rows.map(recordToSearchResult),
    total: typeof data.total === 'number' ? data.total : rows.length,
    page: typeof data.page === 'number' ? data.page : page,
    pages: typeof data.pages === 'number' ? data.pages : 1,
    limit,
  };
}

/**
 * Walk every page of `/api/records` until we've collected the full result set
 * or hit `ALL_MODE_HARD_CAP`. The loop terminates when:
 *   - the current page returned < limit rows (the API's signal for "last page"), OR
 *   - we've reached or passed `data.pages`, OR
 *   - we've collected `ALL_MODE_HARD_CAP` results (safety brake).
 */
export async function searchRecordsAll(query: string, typeFilter: string, limit: number): Promise<SearchEnvelope> {
  const collected: SearchResult[] = [];
  let page = 1;
  let total = 0;
  let pages = 1;
  while (collected.length < ALL_MODE_HARD_CAP) {
    const env = await searchRecords(query, typeFilter, page, limit);
    total = env.total;
    pages = env.pages;
    collected.push(...env.results);
    const lastPage = env.results.length < limit || page >= env.pages;
    if (lastPage) break;
    page++;
  }
  return { results: collected.slice(0, ALL_MODE_HARD_CAP), total, page: 1, pages, limit };
}

/**
 * Legacy fallback, only reachable when `/api/records` returns zero rows AND
 * the user did not narrow the type filter to something other than `skill`.
 * Kept because `/api/find-skills` historically indexed a few archived rows
 * that never made it into the `records` table.
 */
async function fallbackFindSkills(query: string): Promise<SearchResult[]> {
  try {
    const data = await fetchJSON<{ skills?: Array<{ domain: string; skill_id: string; name: string; description: string }> }>(`${getApiBase()}/api/find-skills?q=${encodeURIComponent(query)}`);
    if (!data.skills || data.skills.length === 0) return [];
    return data.skills.map(s => ({
      domain: s.domain, type: 'skill', id: s.skill_id,
      name: s.name, description: s.description,
      address: `${s.domain}/${s.skill_id}`,
    }));
  } catch {
    // Network or 5xx, behave the same as "no results" so the caller can
    // continue to the manifest probe fallback rather than crashing the run.
    return [];
  }
}

/**
 * Last-resort fallback, treat the query as a domain candidate by appending
 * common TLDs. Races `<query>.io` and `<query>.com` in parallel and picks
 * the first non-empty result in priority order. Only fires for bare keywords.
 */
async function fallbackManifestProbe(query: string, typeFilter: string): Promise<SearchResult[]> {
  const domains = query.includes('.') ? [query] : BARE_KEYWORD_TLDS.map(tld => `${query}${tld}`);
  const settled = await Promise.all(domains.map(async (d) => {
    try {
      const data = await fetchJSON<{ manifest?: ManifestData } & ManifestData>(`${getApiBase()}/api/manifests/${encodeURIComponent(d)}`);
      return { d, data };
    } catch {
      // Manifest doesn't exist for this candidate, drop it and try the next TLD.
      return null;
    }
  }));
  for (const entry of settled) {
    if (!entry) continue;
    const { d, data } = entry;
    const manifest: ManifestData = data.manifest ?? data;
    const recs = manifest.records ?? [];
    if (recs.length === 0) continue;
    const filtered = typeFilter ? recs.filter(r => r.type === typeFilter) : recs;
    const mapped: SearchResult[] = [];
    for (const r of filtered) {
      const rid = String(r.record_id ?? r.id ?? '');
      const raw = r.raw_record ?? {};
      mapped.push({
        domain: manifest.domain ?? d,
        type: String(r.type ?? 'skill'),
        id: rid,
        name: String(r.name ?? rid),
        description: String(r.description ?? ''),
        address: `${manifest.domain ?? d}/${rid}`,
        verified: manifest.status === 'active',
        skill_md: (raw['skill_md'] ?? r['skill_md' as keyof ManifestRecord] ?? null) as string | null,
        endpoint: (r.endpoint ?? raw['endpoint'] ?? null) as string | null,
        transport: (r.transport ?? raw['transport'] ?? null) as string | null,
        index: (raw['index'] ?? null) as string | null,
      });
    }
    if (mapped.length > 0) return mapped;
  }
  return [];
}

/**
 * Backwards-compatible entry used by the interactive prompt. Wraps the
 * paginated `searchRecords` and chains the legacy fallbacks if page 1
 * returned nothing.
 */
export async function searchWithFallback(query: string, typeFilter: string, flags: Record<string, unknown>): Promise<SearchResult[]> {
  void flags;
  const env = await searchRecords(query, typeFilter, 1, DEFAULT_LIMIT);
  if (env.results.length > 0) return env.results;
  // Only chain into find-skills if the filter is open or explicitly skill,
  // it only returns skills, so calling it for type=agent etc. is wasted I/O.
  if (!typeFilter || typeFilter === 'skill') {
    const legacy = await fallbackFindSkills(query);
    if (legacy.length > 0) return legacy;
  }
  return fallbackManifestProbe(query, typeFilter);
}

export function displayResults(results: SearchResult[]): void {
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (!r) continue;
    const typeLabel = RECORD_TYPES[r.type] ?? r.type;
    const addr = r.address ?? `${r.domain}/${r.id ?? r.record_id}`;
    const verified = r.verified ? colors.green(' ✓') : '';
    const num = colors.dim(`${i + 1}.`);
    console.log(`  ${num} ${colors.bold(r.name ?? r.id ?? '')} ${colors.dim(`[${typeLabel}]`)} ${colors.dim(`(${addr})`)}${verified}`);
    if (r.description) {
      console.log(`     ${colors.dim(r.description)}`);
    }
  }
  console.log();
  console.log(`  ${colors.dim(`${results.length} result(s)`)}`);
}

function displayPaginationFooter(env: SearchEnvelope, query: string, typeFilter: string): void {
  if (env.total <= env.results.length && env.pages <= 1) return;
  const shown = env.results.length;
  const parts = [`Page ${env.page} of ${env.pages}`, `showing ${shown} of ${env.total} results`];
  let footer = `  ${colors.dim(parts.join(' (') + ')')}`;
  // Build it manually for clarity, the join above is a relic
  footer = `  ${colors.dim(`Page ${env.page} of ${env.pages} (showing ${shown} of ${env.total} results)`)}`;
  // Pagination summary + the "next:" hint are user-facing chatter, not data.
  // Routing them to stderr lets `search --json | jq` work unredirected.
  note(footer);
  if (env.page < env.pages) {
    const typeFlag = typeFilter ? ` --type ${typeFilter}` : '';
    note(`  ${colors.dim(`next: agentroot search ${query}${typeFlag} --page ${env.page + 1}`)}`);
  }
}

export async function selectResult(results: SearchResult[], flags: Record<string, unknown>): Promise<SearchResult | null> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { select } = require('@inquirer/prompts') as {
    select: (opts: { message: string; choices: Array<{ name: string; value: number; description: string }> }) => Promise<number>
  };

  const choices = results.map((r, i) => {
    const typeLabel = RECORD_TYPES[r.type] ?? r.type;
    const verified = r.verified ? ' ✓' : '';
    return {
      name: `${r.name ?? r.id} [${typeLabel}] (${r.domain})${verified}`,
      value: i,
      description: r.description ?? '',
    };
  });

  let selectedIdx: number;
  try {
    selectedIdx = await select({ message: 'Select a result to view details:', choices });
  } catch {
    return null;
  }

  const r = results[selectedIdx];
  if (!r) return null;

  const typeLabel = RECORD_TYPES[r.type] ?? r.type;
  const addr = r.address ?? `${r.domain}/${r.id}`;
  const verified = r.verified ? colors.green(' (verified)') : '';

  console.log();
  console.log(`  ${colors.bold(r.name ?? r.id ?? '')}${verified}`);
  console.log(`  ${colors.dim('type:')}    ${typeLabel}`);
  console.log(`  ${colors.dim('address:')} ${addr}`);
  console.log(`  ${colors.dim('domain:')}  ${r.domain}`);
  if (r.description) console.log(`  ${colors.dim('desc:')}    ${r.description}`);
  if (r.endpoint) console.log(`  ${colors.dim('endpoint:')} ${r.endpoint}`);
  console.log();
  console.log(`  ${colors.dim('To install:')} ${colors.cyan(`npx agent-root install ${addr}`)}`);
  console.log();

  const shouldInstall = await confirmAction('Install this record?', flags ?? {});
  if (shouldInstall) {
    const { promptInstallFromResult } = require('./install-interactive') as { promptInstallFromResult: (r: SearchResult, f: Record<string, unknown>) => Promise<void> };
    await promptInstallFromResult(r, flags ?? {});
  }

  return r;
}

export async function promptSearch(flags: Record<string, unknown>): Promise<SearchResult[] | null> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { input } = require('@inquirer/prompts') as {
    input: (opts: { message: string; validate: (v: string) => boolean | string }) => Promise<string>
  };

  let query: string;
  try {
    query = await input({
      message: 'What are you looking for?',
      validate: (v: string) => v.trim().length > 0 || 'Please enter a search term',
    });
  } catch {
    return null;
  }

  query = query.trim();
  const spinner = maybeSpinner('Searching for "' + query + '"...', flags).start();
  const results = await searchWithFallback(query, '', flags);

  if (results.length === 0) {
    spinner.warn({ text: 'No records found for "' + query + '"' });
    note(`\n  ${colors.dim('Try a domain, skill name, or keyword (e.g. "deploy", "billing", "database")')}`);
    return null;
  }

  spinner.success({ text: results.length + ' result(s) found' });
  console.log();
  displayResults(results);
  await selectResult(results, flags);
  return results;
}

export async function cmdSearch(positional: string[], flags: Record<string, unknown>): Promise<void> {
  const query = positional.join(' ');
  if (!query) {
    fatal('Usage: agentroot search <query> [--type agent|mcp|skill|a2a|payment]', 'Example: agentroot search billing');
  }

  const typeFilter = (flags['type'] as string) ?? '';
  const page = clampPage(flags['page']);
  const limit = clampLimit(flags['limit']);
  const wantsAll = !!flags['all'];

  const spinner = maybeSpinner('Searching for "' + query + '"...', flags).start();

  // Primary path, `/api/records`. We always go here first, the discover/find-skills
  // fallback chain only fires when this returns an empty page 1.
  let envelope = wantsAll
    ? await searchRecordsAll(query, typeFilter, limit)
    : await searchRecords(query, typeFilter, page, limit);

  if (envelope.results.length === 0 && page === 1 && !wantsAll) {
    // Fall back to find-skills + manifest probe, but surface them through the
    // same envelope so JSON consumers always see the same shape.
    const legacy = await searchWithFallback(query, typeFilter, flags);
    if (legacy.length > 0) {
      envelope = { results: legacy, total: legacy.length, page: 1, pages: 1, limit };
    }
  }

  if (envelope.results.length === 0) {
    spinner.warn({ text: 'No records found' });
    if (flags['json']) {
      console.log(JSON.stringify({ results: [], total: 0, page, pages: 0, limit }, null, 2));
    }
    return;
  }

  spinner.success({ text: envelope.results.length + ' result(s) found' });

  if (flags['json']) {
    console.log(JSON.stringify(envelope, null, 2));
    return;
  }

  displayResults(envelope.results);
  displayPaginationFooter(envelope, query, typeFilter);

  if (process.stdout.isTTY && !flags['json']) {
    await selectResult(envelope.results, flags);
  }
}
