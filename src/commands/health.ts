import pc from 'picocolors';
import { fetchJSON } from '../services/http/fetch';
import { getApiBase } from '../services/config/config-service';
import { maybeSpinner } from '../cli/spinner';

interface HealthResponse {
  status?: string;
  db?: string;
  ts?: string;
}

/**
 * Probe `/api/health`. Exit 0 when status=ok AND db=connected, exit 1
 * otherwise. JSON pass-through for scripting. The endpoint is cheap, so
 * we don't apply a longer timeout than the default.
 */
export async function cmdHealth(_positional: string[], flags: Record<string, unknown>): Promise<void> {
  const spinner = maybeSpinner('Checking registry health...', flags).start();

  let data: HealthResponse;
  try {
    data = await fetchJSON<HealthResponse>(`${getApiBase()}/api/health`);
  } catch (err) {
    spinner.error({ text: 'Health check failed' });
    if (flags['json']) {
      console.log(JSON.stringify({ status: 'unreachable', error: (err as Error).message }, null, 2));
    } else {
      console.log(`  ${pc.red('×')} ${(err as Error).message}`);
    }
    process.exit(1);
  }

  const ok = data.status === 'ok' && data.db === 'connected';

  if (flags['json']) {
    spinner.stop();
    console.log(JSON.stringify(data, null, 2));
    if (!ok) process.exit(1);
    return;
  }

  if (ok) {
    spinner.success({ text: 'Registry is healthy' });
  } else {
    spinner.warn({ text: 'Registry reported a degraded state' });
  }

  const mark = ok ? pc.green('✓') : pc.yellow('!');
  console.log();
  console.log(`  ${mark} ${pc.dim('status:')} ${data.status ?? 'unknown'}`);
  console.log(`  ${mark} ${pc.dim('db:')}     ${data.db ?? 'unknown'}`);
  if (data.ts) {
    console.log(`    ${pc.dim('ts:')}     ${data.ts}`);
  }

  if (!ok) process.exit(1);
}
