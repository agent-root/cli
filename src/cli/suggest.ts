/**
 * "Did you mean?" suggestions for unknown commands. Uses plain Levenshtein
 * edit distance (no Damerau swap optimization — typo classes we care about
 * are insertion / deletion / substitution, e.g. `reslove` → `resolve`).
 *
 * The threshold of 2 was picked empirically: it catches 1-letter typos and
 * 1-letter transpositions ("seach"→"search", "reslove"→"resolve") without
 * suggesting unrelated commands for a 4-letter input ("xyz" should suggest
 * nothing, not "search"). Tied scores pick the first command encountered,
 * which is fine because COMMANDS is small and ordered roughly by frequency.
 */

/**
 * Authoritative list of top-level command names the router accepts. Aliases
 * (`r`, `i`, `s`, `ls`, `up`, `rm`, `remove`) are intentionally excluded:
 * suggesting `agentroot ls` for `agentroot lsx` would be more confusing
 * than suggesting `agentroot list`. Keep this in sync with the switch
 * statement in src/index.ts::main().
 */
const COMMANDS = [
  'resolve', 'search', 'install', 'list', 'update', 'uninstall',
  'init', 'validate', 'config', 'health', 'manifests',
  'collections', 'submit', 'version', 'completion', 'help',
] as const;

/**
 * Return the closest command name to `input` within edit distance 2, or
 * `null` if nothing is close enough. Empty input returns null (we don't
 * want `agentroot` to "did you mean: help" — the no-arg path has its own
 * behavior, the interactive prompt or showHelp()).
 */
export function suggestCommand(input: string): string | null {
  if (!input) return null;
  let best: { cmd: string; dist: number } | null = null;
  for (const cmd of COMMANDS) {
    const d = levenshtein(input, cmd);
    if (d <= 2 && (!best || d < best.dist)) {
      best = { cmd, dist: d };
    }
  }
  return best?.cmd ?? null;
}

/**
 * Classic Levenshtein edit distance. O(n*m) time and space; trivially fast
 * for command-name-sized strings. Inlined to avoid a runtime dependency.
 */
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const dp: number[][] = [];
  for (let i = 0; i <= a.length; i++) dp[i] = [i];
  for (let j = 0; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
    }
  }
  return dp[a.length]![b.length]!;
}
