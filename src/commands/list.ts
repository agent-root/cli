import os from 'node:os';
import pc from 'picocolors';
import { readInstalledState } from '@agent-root/core';
import { labelForType } from '../constants/record-types';

export async function cmdList(_positional: string[], flags: Record<string, unknown>): Promise<void> {
  // readInstalledState reads the canonical ~/.agentroot/installed.json and
  // transparently migrates from the legacy ~/.agents/.agentroot-manifest.json
  // on first call. Single source of truth, matches install/uninstall/update.
  const state = readInstalledState();
  const entries = state.installed;
  const keys = Object.keys(entries);

  if (flags['json']) {
    const records = keys.map(k => ({ key: k, ...entries[k] }));
    console.log(JSON.stringify({ records }, null, 2));
    return;
  }

  if (keys.length === 0) {
    console.log('No AgentRoot records installed.');
    console.log(`${pc.dim('Install one: npx agent-root install <domain>/<record-id>')}`);
    return;
  }

  console.log(`${pc.bold('Installed AgentRoot Records')}\n`);

  for (const key of keys) {
    const entry = entries[key];
    if (!entry) continue;
    const typeLabel = labelForType(entry.type);
    console.log(`  ${pc.bold(entry.record_id)} ${pc.dim(`[${typeLabel}]`)} ${pc.dim(`(${entry.domain})`)}`);
    console.log(`  ${pc.dim('installed:')} ${entry.installed_at ? entry.installed_at.split('T')[0] : 'unknown'}  ${pc.dim('hash:')} ${entry.version_hash ?? 'n/a'}`);
    for (const [tool, info] of Object.entries(entry.tools)) {
      const shortPath = info.path.replace(os.homedir(), '~');
      console.log(`  ${pc.dim(tool + ':')} ${shortPath} ${pc.dim('(' + info.link_type + ')')}`);
    }
    console.log();
  }

  console.log(`${pc.dim(`${keys.length} record(s) total`)}`);
}
