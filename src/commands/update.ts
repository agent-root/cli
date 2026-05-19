import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import pc from 'picocolors';
import {
  hashContent, readInstalledState, upsertInstalled, type InstalledEntry,
} from '@agent-root/core';
import { fetch } from '../services/http/fetch';
import { fatal } from '../cli/fatal';
import { maybeSpinner } from '../cli/spinner';

// --- types ---

/**
 * Result of fetching a single installed record's `source_url`. Promoted from
 * a local-to-function type so the handler helpers below can reference it.
 */
type FetchOutcome =
  | { kind: 'skip'; key: string }
  | { kind: 'fail'; key: string; message: string }
  | { kind: 'fetched'; key: string; entry: InstalledEntry; content: string };

interface UpdateTally {
  updated: number;
  upToDate: number;
  failed: number;
}

// --- public entry point ---

export async function cmdUpdate(positional: string[], flags: Record<string, unknown>): Promise<void> {
  const state = readInstalledState();
  const allKeys = Object.keys(state.installed);

  if (positional.length === 0) {
    if (allKeys.length === 0) {
      console.log('No AgentRoot records installed.');
      console.log(`${pc.dim('Install one first: npx agent-root install <domain>/<record-id>')}`);
      return;
    }

    console.log(`${pc.bold('Checking ' + allKeys.length + ' installed record(s)...')}\n`);

    // Fetch every installed record's source in parallel, for N installed
    // skills this turns N sequential round-trips into one round-trip total.
    // We still print per-record results in deterministic key order below.
    const outcomes = await Promise.all(allKeys.map(async (key): Promise<FetchOutcome> => {
      const entry = state.installed[key];
      if (!entry) return { kind: 'skip', key };
      const sourceUrl = entry.source_url;
      if (!sourceUrl) return { kind: 'skip', key };
      try {
        const content = await fetch(sourceUrl);
        return { kind: 'fetched', key, entry, content };
      } catch (err) {
        return { kind: 'fail', key, message: (err as Error).message };
      }
    }));

    const tally = { updated: 0, upToDate: 0, failed: 0 };
    for (const outcome of outcomes) {
      handleOutcome(outcome, state.installed, tally);
    }

    console.log();
    const parts: string[] = [];
    if (tally.upToDate > 0) parts.push(`${tally.upToDate} up to date`);
    if (tally.updated > 0) parts.push(`${tally.updated} updated`);
    if (tally.failed > 0) parts.push(`${tally.failed} failed`);
    console.log(`  ${parts.join(', ')}`);
    return;
  }

  const input = positional[0] as string;
  const slashIdx = input.indexOf('/');
  if (slashIdx === -1) fatal('Expected format: <domain>/<record-id>', 'Example: agentroot update doma.xyz/doma-protocol');

  const domain = input.slice(0, slashIdx);
  const recordId = input.slice(slashIdx + 1);
  const key = `${domain}/${recordId}`;

  const entry = state.installed[key];
  if (!entry) {
    if (flags['json']) {
      console.log(JSON.stringify({ status: 'not-found', message: `No AgentRoot installation found for ${key}` }));
    } else {
      console.log(`No AgentRoot installation found for ${key}`);
      console.log(`${pc.dim(`Install it first: npx agent-root install ${key}`)}`);
    }
    return;
  }

  const sourceUrl = entry.source_url;
  if (!sourceUrl) {
    fatal(`No source_url found in install state for ${key}`, 'Re-install to fix: npx agent-root install ' + key);
  }

  const updateSpinner = maybeSpinner(`Fetching latest ${key}...`, flags).start();

  let content: string;
  try {
    content = await fetch(sourceUrl);
  } catch (err) {
    updateSpinner.error({ text: `Failed to fetch ${key}: ${(err as Error).message}` });
    fatal(`Network error fetching ${sourceUrl}`, 'Check your internet connection and try again');
  }

  const newHash = hashContent(content);
  if (newHash === entry.version_hash) {
    if (updateSpinner.info) updateSpinner.info({ text: 'Already up to date, no changes' });
    else updateSpinner.success({ text: 'Already up to date, no changes' });
    if (flags['json']) {
      console.log(JSON.stringify({ status: 'no-changes', domain, record_id: recordId }));
    }
    return;
  }

  propagateContent(entry, content);
  upsertInstalled({
    domain: entry.domain,
    record_id: entry.record_id,
    type: entry.type,
    name: entry.name,
    description: entry.description,
    source_url: entry.source_url,
    version_hash: newHash,
    tools: entry.tools,
  });
  updateSpinner.success({ text: `${key} updated` });

  if (!flags['json']) {
    for (const [toolName, toolEntry] of Object.entries(entry.tools)) {
      if (toolEntry.link_type === 'copy') {
        console.log(`${pc.green('updated')} ${toolName}: ${toolEntry.path} (copy)`);
      }
    }
  }

  if (flags['json']) {
    console.log(JSON.stringify({ status: 'success', domain, record_id: recordId, version_hash: newHash, propagated_via: 'symlink' }));
  }
}

// --- private helpers ---

/**
 * Dispatch a single fetch outcome to the right side-effect: print + count.
 * Mutates `tally` in place to keep the call site readable as a one-liner.
 *
 * Behavior matches the original three-branch if-chain, pulled out so the
 * orchestration loop in `cmdUpdate` doesn't have to interleave high-level
 * "compute hash, write, log" prose with low-level branching.
 */
function handleOutcome(
  outcome: FetchOutcome,
  installed: Record<string, InstalledEntry>,
  tally: UpdateTally,
): void {
  if (outcome.kind === 'skip') {
    const entry = installed[outcome.key];
    if (entry && !entry.source_url) {
      console.log(`  ${pc.yellow('skip')} ${outcome.key}, no source_url`);
    }
    return;
  }
  if (outcome.kind === 'fail') {
    console.log(`  ${pc.red('fail')} ${outcome.key}, ${outcome.message}`);
    tally.failed++;
    return;
  }
  // outcome.kind === 'fetched'
  const { key, entry, content } = outcome;
  const newHash = hashContent(content);
  if (newHash === entry.version_hash) {
    console.log(`  ${pc.green('✓')} ${key}, up to date`);
    tally.upToDate++;
    return;
  }
  propagateContent(entry, content);
  upsertInstalled({
    domain: entry.domain,
    record_id: entry.record_id,
    type: entry.type,
    name: entry.name,
    description: entry.description,
    source_url: entry.source_url,
    version_hash: newHash,
    tools: entry.tools,
  });
  console.log(`  ${pc.green('↑')} ${key}, ${pc.bold('updated')} (${newHash.slice(0, 8)})`);
  tally.updated++;
}

/**
 * Rewrite SKILL.md in the canonical store and in any per-tool `copy`-link
 * directories. Symlinks pick up changes automatically once the canonical is
 * updated, so they need no per-tool action.
 */
function propagateContent(entry: InstalledEntry, content: string): void {
  const canonicalDir = path.join(os.homedir(), '.agents', 'skills', entry.domain, entry.record_id);
  fs.mkdirSync(canonicalDir, { recursive: true });
  fs.writeFileSync(path.join(canonicalDir, 'SKILL.md'), content, 'utf-8');

  for (const toolEntry of Object.values(entry.tools)) {
    if (toolEntry.link_type === 'copy') {
      fs.mkdirSync(toolEntry.path, { recursive: true });
      fs.writeFileSync(path.join(toolEntry.path, 'SKILL.md'), content, 'utf-8');
    }
  }
}
