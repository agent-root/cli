import { colors } from './colors';
import { EXIT, type ExitCode } from './exit-codes';

/**
 * Print an error and exit. The second positional argument is overloaded:
 *
 *   - `fatal('msg')`                  → exit 1, no hint
 *   - `fatal('msg', 'hint')`          → exit 1, with hint
 *   - `fatal('msg', EXIT.NOHOST)`     → exit 68, no hint
 *   - `fatal('msg', 'hint', EXIT...)` → exit with code, with hint
 *
 * The hint defaults to `undefined`; the code defaults to `EXIT.GENERIC` (1)
 * so every existing 2-arg call site keeps its exit-1 behavior. New call
 * sites pass a sysexits-style code (see src/cli/exit-codes.ts) so shell
 * scripts can branch on the failure mode.
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

  console.error(`${colors.red('error')} ${msg}`);
  if (hint) {
    console.error(`       ${colors.dim(hint)}`);
  }
  process.exit(exit);
}
