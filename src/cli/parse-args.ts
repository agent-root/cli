export interface ParsedArgs {
  cmd: string | undefined;
  positional: string[];
  flags: Record<string, string | boolean>;
}

/**
 * Flags that never take a value, they're always booleans, even when followed
 * by another positional argument. Pulled out of the parsing loop so adding a
 * new boolean flag is a one-line edit and not a buried `||` in a condition.
 *
 * Keys are stored in canonical (camelCase) form. Tokens like `--no-install`
 * are normalized to `noInstall` before this set is consulted.
 */
const BOOLEAN_FLAGS: ReadonlySet<string> = new Set([
  'all', 'project', 'help', 'json', 'force', 'yes', 'version', 'quiet',
  'noInstall',
]);

/**
 * Short single-character aliases for the most common long flags.
 *
 * Recognized only when they appear as a standalone `-x` token. Multi-character
 * single-dash tokens (e.g. `-foo`) are NOT short flags, they remain errors
 * exactly as they were before short aliases existed.
 */
const SHORT_ALIASES: Record<string, string> = {
  h: 'help',
  v: 'version',
  y: 'yes',
  f: 'force',
  q: 'quiet',
  j: 'json',
};

/**
 * Literal `--no-X` tokens that are real flags whose presence means "true",
 * not "set X to false". These must be tracked because the POSIX `--no-X`
 * negation rule would otherwise silently flip them into a different field.
 *
 * Stored in the camelCase form they take after normalization (so `--no-install`
 * normalizes to `noInstall`).
 */
const POSITIVE_NO_FLAGS: ReadonlySet<string> = new Set([
  'noInstall',
]);

/**
 * Convert a kebab-case or snake_case flag name to camelCase. Single-word
 * names pass through unchanged.
 *
 *   'no-install'   -> 'noInstall'
 *   'manifest-url' -> 'manifestUrl'
 *   'json'         -> 'json'
 */
export function toCamelCase(name: string): string {
  return name.replace(/[-_]([a-zA-Z0-9])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Is the token a recognized short alias, e.g. `-h`, `-j`? Single-character
 * unknown shorts (`-x`) and multi-character single-dash tokens (`-foo`) are
 * not treated as short aliases.
 */
function isShortAlias(arg: string): boolean {
  return arg.length === 2 && arg[0] === '-' && arg[1] !== '-' && SHORT_ALIASES[arg.slice(1)] !== undefined;
}

interface SetFlagOptions {
  rawKey: string;       // the key exactly as the user typed it (minus the leading --)
  value: string | boolean;
}

function setFlag(flags: Record<string, string | boolean>, opts: SetFlagOptions): void {
  const canonical = toCamelCase(opts.rawKey);
  flags[canonical] = opts.value;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  // If the first token looks like a flag (e.g. `agent-root --version`), there
  // is no command and the entire array participates in flag parsing.
  const firstLooksLikeFlag = args.length > 0 && (args[0] as string).startsWith('-');
  const cmd = firstLooksLikeFlag ? undefined : (args[0] as string | undefined);
  const startIdx = firstLooksLikeFlag ? 0 : 1;
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  let endOfOptions = false;

  for (let i = startIdx; i < args.length; i++) {
    const arg = args[i] as string;

    // POSIX `--` end-of-options separator: every subsequent token is positional.
    if (!endOfOptions && arg === '--') {
      endOfOptions = true;
      continue;
    }
    if (endOfOptions) {
      positional.push(arg);
      continue;
    }

    // Short single-character aliases: -h, -v, -y, -f, -q, -j.
    // A token like `-foo` (multi-character after a single dash) is NOT a short
    // flag; let it fall through as a positional so existing error behavior is
    // preserved (the dispatcher will reject unknown commands / positionals).
    if (isShortAlias(arg)) {
      const longKey = SHORT_ALIASES[arg.slice(1)] as string;
      setFlag(flags, { rawKey: longKey, value: true });
      continue;
    }

    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }

    // Long flag. Split on the first `=` for POSIX `--key=value` syntax.
    let rawKey = arg.slice(2);
    let inlineValue: string | undefined;
    const eqIdx = rawKey.indexOf('=');
    if (eqIdx !== -1) {
      inlineValue = rawKey.slice(eqIdx + 1);
      rawKey = rawKey.slice(0, eqIdx);
    }

    // Handle `--no-X` negation.
    //
    // If the literal token corresponds to a known "positive" --no-* flag
    // (currently --no-install), treat it as a regular boolean flag so existing
    // call sites that read flags['noInstall'] keep working.
    //
    // Otherwise, `--no-foo` sets foo=false (with the canonical camelCase form).
    if (rawKey.startsWith('no-') && rawKey.length > 3) {
      const camel = toCamelCase(rawKey); // 'noInstall' from 'no-install'
      if (POSITIVE_NO_FLAGS.has(camel)) {
        // Real flag, positive semantics.
        flags[camel] = inlineValue !== undefined ? coerceBool(inlineValue, true) : true;
        continue;
      }
      // POSIX-style negation: --no-json → json=false.
      const negatedKey = toCamelCase(rawKey.slice(3));
      flags[negatedKey] = inlineValue !== undefined ? coerceBool(inlineValue, false) : false;
      continue;
    }

    const canonicalKey = toCamelCase(rawKey);

    // Inline value: --tool=claude.
    if (inlineValue !== undefined) {
      // For known boolean flags, accept truthy/falsy strings.
      if (BOOLEAN_FLAGS.has(canonicalKey)) {
        flags[canonicalKey] = coerceBool(inlineValue, true);
      } else {
        flags[canonicalKey] = inlineValue;
      }
      continue;
    }

    if (BOOLEAN_FLAGS.has(canonicalKey)) {
      flags[canonicalKey] = true;
      continue;
    }

    // Space-separated value: --tool claude.
    const nextArg = args[i + 1] as string | undefined;
    if (
      i + 1 < args.length &&
      nextArg !== undefined &&
      !nextArg.startsWith('--') &&
      nextArg !== '--' &&
      !isShortAlias(nextArg)
    ) {
      flags[canonicalKey] = nextArg;
      i++;
      continue;
    }

    flags[canonicalKey] = true;
  }

  return { cmd, positional, flags };
}

/**
 * Coerce an inline value (everything after `=`) for a known-boolean flag.
 * Anything other than the literal "false", "0", "no", "off" (case-insensitive)
 * is truthy; the `defaultTrue` argument is what we fall back to for unknown
 * strings, since `--json=foo` is more likely a user typo meaning "yes" than
 * "no" on a positive flag and vice-versa on a negated one.
 */
function coerceBool(s: string, defaultTrue: boolean): boolean {
  const lower = s.toLowerCase();
  if (lower === 'false' || lower === '0' || lower === 'no' || lower === 'off') return false;
  if (lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on') return true;
  return defaultTrue;
}
