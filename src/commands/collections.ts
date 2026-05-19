import pc from 'picocolors';
import { fetchJSON } from '../services/http/fetch';
import { getApiBase } from '../services/config/config-service';
import { maybeSpinner } from '../cli/spinner';
import { fatal } from '../cli/fatal';

interface CollectionSummary {
  slug?: string;
  name?: string;
  description?: string;
  item_count?: number;
}

interface CollectionListResponse {
  items?: CollectionSummary[];
  total?: number;
}

interface CollectionItem {
  id?: number;
  position?: number;
  note?: string | null;
  type?: string;
  manifest?: Record<string, unknown>;
}

interface CollectionDetailResponse {
  slug?: string;
  name?: string;
  description?: string;
  total?: number;
  items?: CollectionItem[];
}

function renderCollectionSummary(row: CollectionSummary, idx: number): void {
  const num = pc.dim(`${idx + 1}.`);
  const slug = pc.bold(row.slug ?? '(unknown)');
  const name = row.name ? `${pc.dim('-')} ${row.name}` : '';
  console.log(`  ${num} ${slug} ${name}`);
  if (row.description) {
    console.log(`     ${pc.dim(row.description)}`);
  }
  if (typeof row.item_count === 'number') {
    console.log(`     ${pc.dim('items:')} ${row.item_count}`);
  }
}

async function renderCollectionList(flags: Record<string, unknown>): Promise<void> {
  const spinner = maybeSpinner('Fetching collections...', flags).start();
  const data = await fetchJSON<CollectionListResponse>(`${getApiBase()}/api/collections`);
  const items = Array.isArray(data.items) ? data.items : [];

  if (flags['json']) {
    spinner.stop();
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (items.length === 0) {
    spinner.warn({ text: 'No collections published' });
    return;
  }

  spinner.success({ text: `${items.length} collection(s)` });
  console.log();
  for (let i = 0; i < items.length; i++) {
    const row = items[i];
    if (row) renderCollectionSummary(row, i);
  }
  console.log();
  console.log(`  ${pc.dim('View one:')} ${pc.cyan('agent-root collections <slug>')}`);
}

function renderCollectionItem(item: CollectionItem, idx: number): void {
  const num = pc.dim(`${idx + 1}.`);
  const manifest = item.manifest ?? {};
  const domain = String(manifest['domain'] ?? '(unknown)');
  const status = String(manifest['status'] ?? '?');
  const url = String(manifest['manifest_url'] ?? '');
  const statusBadge = status === 'active' ? pc.green(status) : pc.yellow(status);
  console.log(`  ${num} ${pc.bold(domain)} ${pc.dim(`[${statusBadge}]`)}`);
  if (url) console.log(`     ${pc.dim('manifest:')} ${url}`);
  if (item.note) console.log(`     ${pc.dim('note:')}     ${item.note}`);
}

async function renderCollectionDetail(slug: string, flags: Record<string, unknown>): Promise<void> {
  const spinner = maybeSpinner(`Fetching collection ${slug}...`, flags).start();
  let data: CollectionDetailResponse;
  try {
    data = await fetchJSON<CollectionDetailResponse>(`${getApiBase()}/api/collections/${encodeURIComponent(slug)}`);
  } catch (err) {
    spinner.error({ text: 'Could not fetch collection' });
    fatal(`Collection "${slug}" not found: ${(err as Error).message}`, 'Try: agent-root collections');
  }

  if (flags['json']) {
    spinner.stop();
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  const items = Array.isArray(data.items) ? data.items : [];
  spinner.success({ text: `${data.name ?? slug} (${items.length} item(s))` });

  console.log();
  console.log(`  ${pc.bold(data.name ?? slug)}`);
  if (data.description) console.log(`  ${pc.dim(data.description)}`);
  console.log();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item) renderCollectionItem(item, i);
  }
}

export async function cmdCollections(positional: string[], flags: Record<string, unknown>): Promise<void> {
  const slug = positional[0];
  if (slug) {
    await renderCollectionDetail(slug, flags);
    return;
  }
  await renderCollectionList(flags);
}
