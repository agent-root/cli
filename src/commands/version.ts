import { PACKAGE_VERSION } from '../services/http/package-info';
import { getApiBase, CONFIG_PATH } from '../services/config/config-service';

/**
 * `agent-root version` — prints version, node, OS, API base, config path.
 * Designed to be the first thing pasted into a bug report so we don't have
 * to ask "what version are you on?".
 *
 * With `--json`, the same data is emitted as a single JSON object so scripts
 * can pin against it.
 */
export function cmdVersion(_positional: string[], flags: Record<string, unknown>): void {
  const data = {
    agentRoot: PACKAGE_VERSION,
    node: process.version,
    os: `${process.platform}/${process.arch}`,
    api: getApiBase(),
    config: CONFIG_PATH,
  };

  if (flags['json']) {
    console.log(JSON.stringify(data));
    return;
  }

  // 5-line block, padded so the keys line up.
  console.log(`agent-root ${data.agentRoot}`);
  console.log(`node ${data.node}`);
  console.log(`os   ${data.os}`);
  console.log(`api  ${data.api}`);
  console.log(`config ${data.config}`);
}

/**
 * `agent-root --version` / `-v` — one-line version output, parity with
 * `npm --version`, `node --version`, etc. Lives here so the format is owned
 * by one module.
 */
export function printShortVersion(): void {
  console.log(`agent-root ${PACKAGE_VERSION}`);
}
