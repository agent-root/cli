import { colors } from '../cli/colors';
import { fetchJSON } from '../services/http/fetch';
import { getApiBase } from '../services/config/config-service';
import { maybeSpinner } from '../cli/spinner';
import { note } from '../cli/streams';
import { clampPage, clampLimit } from './search';

/**
 * `--all` safety cap, matches the same constant in search.ts. Stops a
 * sweep over /api/manifests from pulling the entire registry (currently
 * ~1.4k manifests) when a script forgets to narrow the query.
 */
const ALL_MODE_HARD_CAP = 1000;

export interface ManifestRow {
  id?: number;
  domain?: string;
  manifest_url?: string;
  status?: string;
  source?: string;
  protocol_version?: string;
  submitted_at?: string;
  last_verified?: string;
  record_counts?: Record<string, number>;
}

export interface ManifestsEnvelope {
  manifests: ManifestRow[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

interface ManifestsApiResponse {
  manifests?: ManifestRow[];
  total?: number;
  page?: number;
  pages?: number;
}

interface FetchOpts {
  query: string;
  typeFilter: string;
  page: number;
  limit: number;
}

async function fetchPage(opts: FetchOpts): Promise<ManifestsApiResponse> {
  const params = new URLSearchParams({ page: String(opts.page), limit: String(opts.limit) });
  if (opts.query) params.set('q', opts.query);
  if (opts.typeFilter) params.set('type', opts.typeFilter);
  return fetchJSON<ManifestsApiResponse>(`${getApiBase()}/api/manifests?${params.toString()}`);
}

export async function listManifests(opts: FetchOpts): Promise<ManifestsEnvelope> {
  const data = await fetchPage(opts);
  const rows = Array.isArray(data.manifests) ? data.manifests : [];
  return {
    manifests: rows,
    total: typeof data.total === 'number' ? data.total : rows.length,
    page: typeof data.page === 'number' ? data.page : opts.page,
    pages: typeof data.pages === 'number' ? data.pages : 1,
    limit: opts.limit,
  };
}

async function listAllManifests(opts: FetchOpts): Promise<ManifestsEnvelope> {
  const collected: ManifestRow[] = [];
  let page = 1;
  let total = 0;
  let pages = 1;
  while (collected.length < ALL_MODE_HARD_CAP) {
    const env = await listManifests({ ...opts, page });
    total = env.total;
    pages = env.pages;
    collected.push(...env.manifests);
    if (env.manifests.length < opts.limit || page >= env.pages) break;
    page++;
  }
  return { manifests: collected.slice(0, ALL_MODE_HARD_CAP), total, page: 1, pages, limit: opts.limit };
}

function renderRow(row: ManifestRow, idx: number): void {
  const num = colors.dim(`${idx + 1}.`);
  const domain = colors.bold(row.domain ?? '(unknown)');
  const status = row.status === 'active' ? colors.green(row.status) : colors.yellow(row.status ?? 'unknown');
  console.log(`  ${num} ${domain} ${colors.dim(`[${status}]`)}`);
  if (row.manifest_url) {
    console.log(`     ${colors.dim('manifest:')} ${row.manifest_url}`);
  }
  if (row.record_counts) {
    const parts = Object.entries(row.record_counts)
      .filter(([, n]) => typeof n === 'number' && n > 0)
      .map(([k, n]) => `${k}=${n}`);
    if (parts.length > 0) {
      console.log(`     ${colors.dim('records:')}  ${parts.join(', ')}`);
    }
  }
  if (row.last_verified) {
    console.log(`     ${colors.dim('verified:')} ${row.last_verified.split('T')[0]}`);
  }
}

export async function cmdManifests(positional: string[], flags: Record<string, unknown>): Promise<void> {
  const query = (flags['query'] as string) ?? positional.join(' ');
  const typeFilter = (flags['type'] as string) ?? '';
  const page = clampPage(flags['page']);
  const limit = clampLimit(flags['limit']);
  const wantsAll = !!flags['all'];

  const spinner = maybeSpinner('Fetching manifests...', flags).start();

  const envelope = wantsAll
    ? await listAllManifests({ query, typeFilter, page, limit })
    : await listManifests({ query, typeFilter, page, limit });

  if (envelope.manifests.length === 0) {
    spinner.warn({ text: 'No manifests found' });
    if (flags['json']) {
      console.log(JSON.stringify({ manifests: [], total: 0, page, pages: 0, limit }, null, 2));
    }
    return;
  }

  spinner.success({ text: `${envelope.manifests.length} manifest(s)` });

  if (flags['json']) {
    console.log(JSON.stringify(envelope, null, 2));
    return;
  }

  console.log();
  for (let i = 0; i < envelope.manifests.length; i++) {
    const row = envelope.manifests[i];
    if (!row) continue;
    renderRow(row, i);
  }
  console.log();
  // Pagination footer + "next:" hint are commentary, not data.
  note(`  ${colors.dim(`Page ${envelope.page} of ${envelope.pages} (showing ${envelope.manifests.length} of ${envelope.total} manifests)`)}`);
  if (envelope.page < envelope.pages) {
    const typeFlag = typeFilter ? ` --type ${typeFilter}` : '';
    const qFlag = query ? ` --query ${query}` : '';
    note(`  ${colors.dim(`next: agentroot manifests${qFlag}${typeFlag} --page ${envelope.page + 1}`)}`);
  }
}
