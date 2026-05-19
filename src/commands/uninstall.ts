import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import pc from 'picocolors';
import { readInstalledState, removeInstalledState } from '@agent-root/core';
import { fatal } from '../cli/fatal';
import { confirmAction } from '../cli/confirm';
import { labelForType } from '../constants/record-types';

export async function cmdUninstall(positional: string[], flags: Record<string, unknown>): Promise<void> {
  const state = readInstalledState();
  const allKeys = Object.keys(state.installed);

  if (positional.length === 0) {
    if (allKeys.length === 0) {
      console.log('No AgentRoot records installed.');
      return;
    }

    if (!process.stdout.isTTY || flags['json']) {
      fatal('Usage: agentroot uninstall <domain>/<record-id>', 'Example: agentroot uninstall nameyard.io/nameyard-billing');
    }

    console.log(`\n  ${pc.bold('Installed records:')}`);
    for (let i = 0; i < allKeys.length; i++) {
      const k = allKeys[i] as string;
      const entry = state.installed[k];
      if (!entry) continue;
      const toolCount = Object.keys(entry.tools).length;
      const typeLabel = labelForType(entry.type);
      console.log(`  ${pc.dim((i + 1) + '.')} ${pc.bold(entry.record_id)} ${pc.dim(`[${typeLabel}]`)} ${pc.dim(`(${entry.domain})`)} ${pc.dim(`(${toolCount} tool${toolCount !== 1 ? 's' : ''})`)}`);
    }
    console.log();

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { select } = require('@inquirer/prompts') as {
      select: (opts: { message: string; choices: Array<{ name: string; value: string }> }) => Promise<string>
    };
    let selectedKey: string;
    try {
      selectedKey = await select({
        message: 'Select record to uninstall:',
        choices: allKeys.map(k => {
          const e = state.installed[k as string];
          const toolCount = Object.keys(e?.tools ?? {}).length;
          return { name: `${e?.record_id ?? k} (${e?.domain ?? 'unknown'}) (${toolCount} tool${toolCount !== 1 ? 's' : ''})`, value: k as string };
        }),
      });
    } catch {
      return;
    }
    positional = [selectedKey];
  }

  const input = positional[0] as string;
  const slashIdx = input.indexOf('/');
  if (slashIdx === -1) {
    fatal('Expected format: <domain>/<record-id>', 'Example: agentroot uninstall nameyard.io/nameyard-billing');
  }

  const domain = input.slice(0, slashIdx);
  const recordId = input.slice(slashIdx + 1);
  const key = `${domain}/${recordId}`;

  const entry = state.installed[key];
  if (!entry) {
    if (flags['json']) {
      console.log(JSON.stringify({ status: 'not-found', message: `No AgentRoot installation found for ${key}` }));
    } else {
      console.log(`No AgentRoot installation found for ${key}`);
    }
    return;
  }

  const confirmed = await confirmAction(
    `Remove all copies of ${key}? This will delete the canonical copy and all tool symlinks.`,
    flags
  );
  if (!confirmed) {
    if (flags['json']) {
      console.log(JSON.stringify({ status: 'cancelled' }));
    } else {
      console.log('Uninstall cancelled.');
    }
    return;
  }

  const removedList: Array<{ tool: string; path: string; link_type?: string }> = [];

  try {
    for (const [toolName, toolEntry] of Object.entries(entry.tools)) {
      if (fs.existsSync(toolEntry.path)) {
        fs.rmSync(toolEntry.path, { recursive: true, force: true });
      }
      removedList.push({ tool: toolName, path: toolEntry.path, link_type: toolEntry.link_type });
      if (!flags['json']) console.log(`${pc.green('removed')} ${toolName}: ${toolEntry.path}`);
    }

    const canonicalDir = path.join(os.homedir(), '.agents', 'skills', domain, recordId);
    if (fs.existsSync(canonicalDir)) {
      fs.rmSync(canonicalDir, { recursive: true, force: true });
    }
    if (!flags['json']) console.log(`${pc.green('removed')} canonical: ${canonicalDir}`);

    removeInstalledState(domain, recordId);

    if (flags['json']) {
      console.log(JSON.stringify({ status: 'success', removed: removedList, canonical: canonicalDir }));
    } else {
      console.log(`\n${pc.green('✓')} ${key} uninstalled (${removedList.length} tool copies removed)`);
    }
  } catch (err) {
    fatal(`Failed to uninstall ${key}: ${(err as Error).message}`, 'Check file permissions and try again');
  }
}
