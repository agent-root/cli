/**
 * Stream-discipline helper.
 *
 * Per 12-Factor #4 ("Mind the streams"), only pipeable *data* should land on
 * stdout. Everything else — progress messages, comments, hints, "Installing X"
 * status lines, warnings — belongs on stderr. The acceptance test that drives
 * this module is: `agent-root <cmd> --json | jq .` must always succeed without
 * the user needing `2>/dev/null`.
 *
 * Today there is no global "are we quiet?" state because the parser holds that
 * decision in `flags.quiet` and the only consumers are inside command handlers
 * that already have `flags` in scope. We add a `configureQuiet()` setter for
 * code paths that don't receive `flags` (e.g. the auto-install banner in
 * `services/config/defaults.ts`) so they can still be muted.
 */

let quiet = false;

/**
 * Wire the global "quiet" state from parsed flags. Call this once in main()
 * after configureColors() but before any command dispatch. Safe to re-call
 * (test setup).
 */
export function configureQuiet(flags: Record<string, unknown> = {}): void {
  quiet = !!flags['quiet'];
}

/**
 * Force a specific quiet state. Test-only entry point, prefer
 * `configureQuiet()` in production code.
 */
export function setQuietForTest(value: boolean): void {
  quiet = value;
}

/**
 * Is the CLI in quiet mode? Used by spinner and other chatter to short-circuit.
 */
export function isQuiet(): boolean {
  return quiet;
}

/**
 * Write a "note" — comments, progress, tips, warnings — to stderr. Suppressed
 * entirely in quiet mode. Identical signature to `console.error`.
 *
 * Use this for anything that is NOT the pipeable result of the command. The
 * rule of thumb: if you wrap it in `colors.dim()` because it's a hint, it's a
 * note; if it's the actual record/JSON/data being requested, use `console.log`.
 */
export function note(...args: unknown[]): void {
  if (quiet) return;
  console.error(...args);
}
