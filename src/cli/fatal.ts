import pc from 'picocolors';

export function fatal(msg: string, suggestion?: string): never {
  console.error(`${pc.red('error')} ${msg}`);
  if (suggestion) {
    console.error(`       ${pc.dim(suggestion)}`);
  }
  process.exit(1);
}
