import os from 'node:os';
import { colors } from '../cli/colors';
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
    console.log(`${colors.dim('Install one: npx agent-root install <domain>/<record-id>')}`);
    return;
  }

  console.log(`${colors.bold('Installed AgentRoot Records')}\n`);

  for (const key of keys) {
    const entry = entries[key];
    if (!entry) continue;
    const typeLabel = labelForType(entry.type);
    console.log(`  ${colors.bold(entry.record_id)} ${colors.dim(`[${typeLabel}]`)} ${colors.dim(`(${entry.domain})`)}`);
    console.log(`  ${colors.dim('installed:')} ${entry.installed_at ? entry.installed_at.split('T')[0] : 'unknown'}  ${colors.dim('hash:')} ${entry.version_hash ?? 'n/a'}`);
    for (const [tool, info] of Object.entries(entry.tools)) {
      const shortPath = info.path.replace(os.homedir(), '~');
      console.log(`  ${colors.dim(tool + ':')} ${shortPath} ${colors.dim('(' + info.link_type + ')')}`);
    }
    console.log();
  }

  console.log(`${colors.dim(`${keys.length} record(s) total`)}`);
}
