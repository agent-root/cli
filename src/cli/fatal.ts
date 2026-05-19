import { colors } from './colors';

export function fatal(msg: string, suggestion?: string): never {
  console.error(`${colors.red('error')} ${msg}`);
  if (suggestion) {
    console.error(`       ${colors.dim(suggestion)}`);
  }
  process.exit(1);
}
