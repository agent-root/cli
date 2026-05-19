import { colors } from '../cli/colors';
import { fetchJSON } from '../services/http/fetch';
import { getApiBase } from '../services/config/config-service';
import { maybeSpinner } from '../cli/spinner';
import { fatal } from '../cli/fatal';
import { EXIT } from '../cli/exit-codes';

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
    // Route through fatal() so --json gets the standard error envelope, and
    // the exit code reflects "service unreachable" rather than generic 1.
    const e = err as NodeJS.ErrnoException;
    const code = (e.code === 'ENOTFOUND' || e.code === 'EAI_AGAIN') ? EXIT.NOHOST : EXIT.UNAVAILABLE;
    fatal((err as Error).message, 'The registry is unreachable. Check your connection.', code);
  }

  const ok = data.status === 'ok' && data.db === 'connected';

  if (flags['json']) {
    spinner.stop();
    console.log(JSON.stringify(data, null, 2));
    if (!ok) process.exit(EXIT.UNAVAILABLE);
    return;
  }

  if (ok) {
    spinner.success({ text: 'Registry is healthy' });
  } else {
    spinner.warn({ text: 'Registry reported a degraded state' });
  }

  const mark = ok ? colors.green('✓') : colors.yellow('!');
  console.log();
  console.log(`  ${mark} ${colors.dim('status:')} ${data.status ?? 'unknown'}`);
  console.log(`  ${mark} ${colors.dim('db:')}     ${data.db ?? 'unknown'}`);
  if (data.ts) {
    console.log(`    ${colors.dim('ts:')}     ${data.ts}`);
  }

  if (!ok) process.exit(EXIT.UNAVAILABLE);
}
