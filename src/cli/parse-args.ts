export interface ParsedArgs {
  cmd: string | undefined;
  positional: string[];
  flags: Record<string, string | boolean>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const cmd = args[0] as string | undefined;
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i] as string;
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1] as string | undefined;
      if (key === 'all' || key === 'project' || key === 'help' || key === 'json' || key === 'force' || key === 'yes') {
        flags[key] = true;
      } else if (i + 1 < args.length && nextArg !== undefined && !nextArg.startsWith('--')) {
        flags[key] = nextArg;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { cmd, positional, flags };
}
