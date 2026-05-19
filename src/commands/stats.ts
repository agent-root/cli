import { colors } from '../cli/colors';
import { fetchJSON } from '../services/http/fetch';
import { getApiBase } from '../services/config/config-service';
import { maybeSpinner } from '../cli/spinner';

interface CountsBlock {
  total?: number;
  active?: number;
  pending?: number;
  failed?: number;
  total_items?: number;
}

interface StatsResponse {
  agents?: CountsBlock;
  skills?: CountsBlock;
  total?: number;
  active?: number;
  pending?: number;
  failed?: number;
  byTld?: Record<string, number>;
}

function formatBlock(label: string, block: CountsBlock | undefined): void {
  if (!block) return;
  console.log(`  ${colors.bold(label)}`);
  console.log(`    ${colors.dim('total:')}   ${block.total ?? 0}`);
  console.log(`    ${colors.dim('active:')}  ${block.active ?? 0}`);
  console.log(`    ${colors.dim('pending:')} ${block.pending ?? 0}`);
  console.log(`    ${colors.dim('failed:')}  ${block.failed ?? 0}`);
  if (typeof block.total_items === 'number') {
    console.log(`    ${colors.dim('items:')}   ${block.total_items}`);
  }
}

function formatByTld(byTld: Record<string, number> | undefined): void {
  if (!byTld) return;
  const entries = Object.entries(byTld).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return;
  console.log(`  ${colors.bold('By TLD')}`);
  for (const [tld, count] of entries) {
    console.log(`    ${colors.dim('.' + tld + ':')} ${count}`);
  }
}

export async function cmdStats(_positional: string[], flags: Record<string, unknown>): Promise<void> {
  const spinner = maybeSpinner('Fetching registry stats...', flags).start();
  const data = await fetchJSON<StatsResponse>(`${getApiBase()}/api/stats`);
  spinner.success({ text: 'Registry stats' });

  if (flags['json']) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  console.log();
  formatBlock('Agents', data.agents);
  console.log();
  formatBlock('Skills', data.skills);
  console.log();
  formatByTld(data.byTld);
}
