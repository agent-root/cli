import pc from 'picocolors';

/**
 * Module-local "are colors off?" flag. Set by `configureColors()`, read by the
 * wrapped color helpers below. Defaults to "auto-detect" semantics, every
 * helper does its own check until the parser-driven `configureColors()` runs.
 *
 * Why not stateless? Because the same process call site (e.g. `colors.bold(x)`
 * in a template literal at module top-level) is evaluated long before we know
 * whether the user passed `--no-color`. Reading the env on every call covers
 * `NO_COLOR` automatically; the flag override is the only piece that needs the
 * parser to have run, hence this small piece of state.
 */
let disabled: boolean | null = null;

/**
 * Decide whether ANSI color should be suppressed.
 *
 * Precedence (any-truthy disables color):
 *   1. `NO_COLOR=<anything-non-empty>` per the no-color.org standard.
 *   2. `FORCE_COLOR=0` (Node convention).
 *   3. `AGENTROOT_NO_COLOR=<anything-non-empty>` (namespaced override).
 *   4. `--no-color` flag (only honored if `configureColors()` has run).
 *   5. Stdout is not a TTY.
 *
 * The TTY check matches what most flagship CLIs do: piped/redirected output
 * gets clean ASCII even without an explicit flag.
 */
function computeDisabled(flagsOverride?: boolean): boolean {
  if (flagsOverride) return true;
  if (process.env['NO_COLOR'] && process.env['NO_COLOR'].length > 0) return true;
  if (process.env['FORCE_COLOR'] === '0') return true;
  if (process.env['AGENTROOT_NO_COLOR'] && process.env['AGENTROOT_NO_COLOR'].length > 0) return true;
  return !process.stdout.isTTY;
}

/**
 * Initialize the color-disabled state from parsed flags. Call this once in
 * `main()` *before* anything else writes color. Safe to re-call (test setup).
 */
export function configureColors(flags: Record<string, unknown> = {}): void {
  const flagOverride = !!flags['noColor'];
  disabled = computeDisabled(flagOverride);
}

/**
 * Force a specific disabled state. Test-only entry point, prefer
 * `configureColors()` in production code.
 */
export function setColorsDisabledForTest(value: boolean | null): void {
  disabled = value;
}

/**
 * Query helper, mostly for tests and callers that need to decide whether to
 * emit a colored or plain variant of the same string.
 */
export function isColorDisabled(): boolean {
  if (disabled !== null) return disabled;
  // Lazy fallback: if the caller never ran configureColors(), still honor env.
  return computeDisabled(false);
}

function wrap(fn: (s: string) => string): (s: string) => string {
  return (s: string) => (isColorDisabled() ? s : fn(s));
}

/**
 * Drop-in replacement for the subset of `picocolors` we actually call.
 * Every helper returns the raw string when color is disabled.
 */
export const colors = {
  bold: wrap(pc.bold),
  dim: wrap(pc.dim),
  cyan: wrap(pc.cyan),
  green: wrap(pc.green),
  red: wrap(pc.red),
  yellow: wrap(pc.yellow),
};
