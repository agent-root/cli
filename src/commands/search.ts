import pc from 'picocolors';
import { fetchJSON } from '../lib/fetch';
import { getApiBase } from '../lib/config';
import { fatal } from '../cli/fatal';
import { maybeSpinner } from '../cli/spinner';
import { confirmAction } from '../cli/confirm';
import { RECORD_TYPES } from '../constants/record-types';

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

export async function searchWithFallback(query: string, typeFilter: string, flags: Record<string, unknown>): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query });
  if (typeFilter) params.set('type', typeFilter);

  let results: SearchResult[] = [];

  // 1. Try discover endpoint
  try {
    const data = await fetchJSON<{ results?: SearchResult[] }>(`${getApiBase()}/api/discover?${params.toString()}`);
    if (data.results && data.results.length > 0) {
      results = data.results;
    }
  } catch {}

  // 2. Fallback: legacy find-skills
  if (results.length === 0) {
    try {
      const data = await fetchJSON<{ skills?: Array<{ domain: string; skill_id: string; name: string; description: string }> }>(`${getApiBase()}/api/find-skills?q=${encodeURIComponent(query)}`);
      if (data.skills && data.skills.length > 0) {
        results = data.skills.map(s => ({
          domain: s.domain, type: 'skill', id: s.skill_id,
          name: s.name, description: s.description,
          address: `${s.domain}/${s.skill_id}`,
        }));
      }
    } catch {}
  }

  // 3. Fallback: manifests API
  if (results.length === 0) {
    const domains = query.includes('.') ? [query] : [`${query}.io`, `${query}.com`];
    for (const d of domains) {
      try {
        const data = await fetchJSON<{ manifest?: ManifestData } & ManifestData>(`${getApiBase()}/api/manifests/${encodeURIComponent(d)}`);
        const manifest: ManifestData = data.manifest ?? data;
        const recs = manifest.records ?? [];
        if (recs.length > 0) {
          const filtered = typeFilter ? recs.filter(r => r.type === typeFilter) : recs;
          for (const r of filtered) {
            const rid = String(r.record_id ?? r.id ?? '');
            const raw = r.raw_record ?? {};
            results.push({
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
          if (results.length > 0) break;
        }
      } catch {}
    }
  }

  void flags;
  return results;
}

export function displayResults(results: SearchResult[]): void {
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (!r) continue;
    const typeLabel = RECORD_TYPES[r.type] ?? r.type;
    const addr = r.address ?? `${r.domain}/${r.id ?? r.record_id}`;
    const verified = r.verified ? pc.green(' ✓') : '';
    const num = pc.dim(`${i + 1}.`);
    console.log(`  ${num} ${pc.bold(r.name ?? r.id ?? '')} ${pc.dim(`[${typeLabel}]`)} ${pc.dim(`(${addr})`)}${verified}`);
    if (r.description) {
      console.log(`     ${pc.dim(r.description)}`);
    }
  }
  console.log();
  console.log(`  ${pc.dim(`${results.length} result(s)`)}`);
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
  const verified = r.verified ? pc.green(' (verified)') : '';

  console.log();
  console.log(`  ${pc.bold(r.name ?? r.id ?? '')}${verified}`);
  console.log(`  ${pc.dim('type:')}    ${typeLabel}`);
  console.log(`  ${pc.dim('address:')} ${addr}`);
  console.log(`  ${pc.dim('domain:')}  ${r.domain}`);
  if (r.description) console.log(`  ${pc.dim('desc:')}    ${r.description}`);
  if (r.endpoint) console.log(`  ${pc.dim('endpoint:')} ${r.endpoint}`);
  console.log();
  console.log(`  ${pc.dim('To install:')} ${pc.cyan(`npx agent-root install ${addr}`)}`);
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
    console.log(`\n  ${pc.dim('Try a domain, skill name, or keyword (e.g. "deploy", "billing", "database")')}`);
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
  const spinner = maybeSpinner('Searching for "' + query + '"...', flags).start();

  const results = await searchWithFallback(query, typeFilter, flags);

  if (results.length === 0) {
    spinner.warn({ text: 'No records found' });
    if (flags['json']) {
      console.log(JSON.stringify({ results: [], count: 0 }, null, 2));
    }
    return;
  }

  spinner.success({ text: results.length + ' result(s) found' });

  if (flags['json']) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  displayResults(results);

  if (process.stdout.isTTY && !flags['json']) {
    await selectResult(results, flags);
  }
}
