import pc from 'picocolors';
import { API_BASE } from '@agent-root/core';
import { loadConfig, saveConfig, CONFIG_PATH } from '../services/config/config-service';
import { fatal } from '../cli/fatal';

export async function cmdConfig(positional: string[], _flags: Record<string, unknown>): Promise<void> {
  const subCmd = positional[0];

  if (subCmd === 'set') {
    const key = positional[1];
    const value = positional[2];
    if (!key || !value) {
      fatal('Usage: agentroot config set <key> <value>', 'Example: agentroot config set api-url http://localhost:4747');
    }
    const current = loadConfig();
    current[key] = value;
    saveConfig(current);
    console.log(`${pc.green('set')} ${key} = ${value}`);
    console.log(`${pc.dim(`Saved to ${CONFIG_PATH}`)}`);
    return;
  }

  if (subCmd === 'get' || !subCmd) {
    const current = loadConfig();
    const keys = Object.keys(current);
    if (keys.length === 0) {
      console.log(pc.dim('No configuration set. Defaults in use.'));
      console.log(pc.dim(`  api-url = ${API_BASE}  (default)`));
      return;
    }
    console.log(pc.bold('Current configuration:'));
    for (const k of keys) {
      console.log(`  ${pc.cyan(k)} = ${current[k]}`);
    }
    console.log(pc.dim(`\nLoaded from ${CONFIG_PATH}`));
    return;
  }

  fatal(`Unknown config subcommand: ${subCmd}`, 'Usage: agentroot config set <key> <value>  |  agentroot config get');
}
