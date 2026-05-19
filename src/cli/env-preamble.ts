/**
 * Side-effect-only module: must be imported BEFORE anything that touches
 * picocolors / nanospinner. Picocolors decides `isColorSupported` at module
 * load by reading `process.env` and `process.argv`. It treats `env.CI` as a
 * *positive* color signal (because most CI runners DO support color), which
 * is the opposite of what users typically want when scripting agentroot in CI.
 *
 * We patch the env *before* the rest of the bundle imports anything that
 * reads it. Two cases:
 *
 *   1. User wants color suppressed (NO_COLOR set, --no-color flag, CI=true):
 *      Set `NO_COLOR=1` and unset `FORCE_COLOR` so picocolors picks "off".
 *   2. Otherwise: leave the env alone.
 *
 * This is the cheapest way to make every downstream library (picocolors,
 * nanospinner, @inquirer/prompts ANSI rendering) agree with the user's intent
 * without forking each one's color-detection logic.
 */
function shouldSuppressColorEarly(): boolean {
  const env = process.env;
  if (env['NO_COLOR'] && env['NO_COLOR'].length > 0) return true;
  if (env['AGENTROOT_NO_COLOR'] && env['AGENTROOT_NO_COLOR'].length > 0) return true;
  if (env['FORCE_COLOR'] === '0') return true;
  // Light argv scan — we are pre-parser, so just look for the literal token.
  // Both `--no-color` and `--no-color=true` (and `--no-color=yes`) suppress.
  for (const tok of process.argv.slice(2)) {
    if (tok === '--no-color') return true;
    if (tok.startsWith('--no-color=')) {
      const val = tok.slice('--no-color='.length).toLowerCase();
      if (val !== 'false' && val !== '0' && val !== 'no' && val !== 'off') return true;
    }
  }
  // CI=true: most CIs set this. Match the convention of gh, pnpm, biome
  // (all default to plain text in CI). User can opt back in with
  // `FORCE_COLOR=1` if they really want colored CI logs.
  if (env['CI'] && env['CI'].length > 0 && env['FORCE_COLOR'] !== '1') return true;
  return false;
}

if (shouldSuppressColorEarly()) {
  // Setting NO_COLOR makes picocolors's `isColorSupported` evaluate to false.
  process.env['NO_COLOR'] = '1';
  // FORCE_COLOR=0 would override; FORCE_COLOR=1 would override the other way.
  // We only clear it when it would conflict with the no-color intent.
  if (process.env['FORCE_COLOR'] && process.env['FORCE_COLOR'] !== '0') {
    delete process.env['FORCE_COLOR'];
  }
}
