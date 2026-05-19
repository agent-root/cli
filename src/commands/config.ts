import { colors } from '../cli/colors';
import { API_BASE } from '@agent-root/core';
import { loadConfig, saveConfig, CONFIG_PATH } from '../services/config/config-service';
import { note } from '../cli/streams';
import { fatal } from '../cli/fatal';
import { EXIT } from '../cli/exit-codes';

export async function cmdConfig(positional: string[], _flags: Record<string, unknown>): Promise<void> {
  const subCmd = positional[0];

  if (subCmd === 'set') {
    const key = positional[1];
    const value = positional[2];
    if (!key || !value) {
      fatal('Usage: agentroot config set <key> <value>', 'Example: agentroot config set api-url http://localhost:4747', EXIT.USAGE);
    }
    const current = loadConfig();
    current[key] = value;
    saveConfig(current);
    console.log(`${colors.green('set')} ${key} = ${value}`);
    // "Saved to X" is a side-note about where it landed, not the result.
    note(`${colors.dim(`Saved to ${CONFIG_PATH}`)}`);
    return;
  }

  if (subCmd === 'get' || !subCmd) {
    const current = loadConfig();
    const keys = Object.keys(current);
    if (keys.length === 0) {
      console.log(colors.dim('No configuration set. Defaults in use.'));
      console.log(colors.dim(`  api-url = ${API_BASE}  (default)`));
      return;
    }
    console.log(colors.bold('Current configuration:'));
    for (const k of keys) {
      console.log(`  ${colors.cyan(k)} = ${current[k]}`);
    }
    note(colors.dim(`\nLoaded from ${CONFIG_PATH}`));
    return;
  }

  fatal(`Unknown config subcommand: ${subCmd}`, 'Usage: agentroot config set <key> <value>  |  agentroot config get', EXIT.USAGE);
}
