export interface ParsedArgs {
  cmd: string | undefined;
  positional: string[];
  flags: Record<string, string | boolean>;
}

/**
 * Flags that never take a value — they're always booleans, even when followed
 * by another positional argument. Pulled out of the parsing loop so adding a
 * new boolean flag is a one-line edit and not a buried `||` in a condition.
 */
const BOOLEAN_FLAGS: ReadonlySet<string> = new Set([
  'all', 'project', 'help', 'json', 'force', 'yes',
]);

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const cmd = args[0] as string | undefined;
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i] as string;
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const nextArg = args[i + 1] as string | undefined;
    if (BOOLEAN_FLAGS.has(key)) {
      flags[key] = true;
      continue;
    }
    if (i + 1 < args.length && nextArg !== undefined && !nextArg.startsWith('--')) {
      flags[key] = nextArg;
      i++;
      continue;
    }
    flags[key] = true;
  }
  return { cmd, positional, flags };
}
