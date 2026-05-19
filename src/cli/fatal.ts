import { colors } from './colors';
import { EXIT, exitCodeName, type ExitCode } from './exit-codes';

/**
 * Module-local "are we in --json mode?" flag. Set by `configureJsonMode()`
 * from `main()` after parseArgs, read by `fatal()` to decide between
 * the human-readable error line and a JSON error envelope on stdout.
 *
 * We need this because plenty of `fatal()` call sites don't have `flags`
 * in scope (e.g. nested service helpers like install-skill), and we don't
 * want to thread the parsed flags through every call signature just to
 * format errors.
 */
let jsonMode = false;

/**
 * Wire the global "is --json mode on?" state from parsed flags. Call once
 * in main() after parseArgs, before any command dispatch. Safe to re-call
 * (test setup).
 */
export function configureJsonMode(flags: Record<string, unknown> = {}): void {
  jsonMode = !!flags['json'];
}

/**
 * Test-only override. Prefer `configureJsonMode()` in production code.
 */
export function setJsonModeForTest(value: boolean): void {
  jsonMode = value;
}

/**
 * Is the CLI in --json mode? Exposed for callers that want to switch
 * formatting on it without re-reading flags.
 */
export function isJsonMode(): boolean {
  return jsonMode;
}

/**
 * Print an error and exit. The second positional argument is overloaded:
 *
 *   - `fatal('msg')`                  → exit 1, no hint
 *   - `fatal('msg', 'hint')`          → exit 1, with hint
 *   - `fatal('msg', EXIT.NOHOST)`     → exit 68, no hint
 *   - `fatal('msg', 'hint', EXIT...)` → exit with code, with hint
 *
 * In --json mode, the error goes to stdout as a single envelope so callers
 * can `cmd --json | jq '.error.code'` without redirecting stderr. The exit
 * code is still non-zero, so scripts can branch on `$?` and `jq` together.
 * Non-JSON mode keeps the existing behavior: human text on stderr.
 *
 * The envelope shape is intentionally minimal:
 *   { "error": { "code": "NOHOST", "message": "...", "hint": "..." } }
 * `hint` is omitted when no suggestion was provided.
 */
export function fatal(msg: string, hintOrCode?: string | ExitCode, code?: ExitCode): never {
  let hint: string | undefined;
  let exit: ExitCode = EXIT.GENERIC;
  if (typeof hintOrCode === 'number') {
    exit = hintOrCode;
  } else if (typeof hintOrCode === 'string') {
    hint = hintOrCode;
  }
  if (typeof code === 'number') exit = code;

  if (jsonMode) {
    const envelope = {
      error: {
        code: exitCodeName(exit),
        message: msg,
        ...(hint ? { hint } : {}),
      },
    };
    process.stdout.write(JSON.stringify(envelope, null, 2) + '\n');
  } else {
    console.error(`${colors.red('error')} ${msg}`);
    if (hint) {
      console.error(`       ${colors.dim(hint)}`);
    }
  }
  process.exit(exit);
}
