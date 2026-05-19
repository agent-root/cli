import pc from 'picocolors';
import { createSpinner } from 'nanospinner';

export const RECORD_TYPES: Record<string, string> = {
  agent: 'Agent',
  mcp: 'MCP Server',
  skill: 'Skill',
  a2a: 'A2A Endpoint',
  payment: 'Payment',
};

export interface ParsedArgs {
  cmd: string | undefined;
  positional: string[];
  flags: Record<string, string | boolean>;
}

export interface SpinnerLike {
  start(): SpinnerLike;
  stop(): SpinnerLike;
  success(opts?: { text?: string }): SpinnerLike;
  error(opts?: { text?: string }): SpinnerLike;
  update(opts?: { text?: string }): SpinnerLike;
  warn(opts?: { text?: string }): SpinnerLike;
  info(opts?: { text?: string }): SpinnerLike;
}

const _noop: SpinnerLike = {
  start() { return _noop; },
  stop() { return _noop; },
  success() { return _noop; },
  error() { return _noop; },
  update() { return _noop; },
  warn() { return _noop; },
  info() { return _noop; },
};

export function fatal(msg: string, suggestion?: string): never {
  console.error(`${pc.red('error')} ${msg}`);
  if (suggestion) {
    console.error(`       ${pc.dim(suggestion)}`);
  }
  process.exit(1);
}

export function maybeSpinner(text: string, flags: Record<string, unknown>): SpinnerLike {
  if (flags && flags.json) return _noop;
  return createSpinner(text) as unknown as SpinnerLike;
}

export async function confirmAction(message: string, flags: Record<string, unknown>): Promise<boolean> {
  if (flags.yes || !process.stdout.isTTY) return true;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { confirm } = require('@inquirer/prompts') as { confirm: (opts: { message: string; default: boolean }) => Promise<boolean> };
  try {
    return await confirm({ message, default: false });
  } catch {
    return false;
  }
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

export function formatRecord(r: Record<string, unknown>, indent?: string): string {
  const ind = indent || '  ';
  const typeLabel = RECORD_TYPES[r.type as string] || r.type as string;
  let out = '';
  out += `${ind}${pc.bold((r.name || r.id) as string)} ${pc.dim(`(${typeLabel})`)}\n`;
  out += `${ind}${pc.dim('address:')} ${r._domain || ''}/${r.id}\n`;
  if (r.description) out += `${ind}${pc.dim('desc:')}    ${r.description as string}\n`;
  if (r.endpoint)    out += `${ind}${pc.dim('endpoint:')} ${r.endpoint as string}\n`;
  if (r.transport)   out += `${ind}${pc.dim('transport:')} ${r.transport as string}\n`;
  if (r.protocol)    out += `${ind}${pc.dim('protocol:')} ${r.protocol as string}\n`;
  if (r.auth)        out += `${ind}${pc.dim('auth:')}     ${r.auth as string}\n`;
  if (r.pricing)     out += `${ind}${pc.dim('pricing:')}  ${r.pricing as string}\n`;
  if (r.index)       out += `${ind}${pc.dim('index:')}    ${r.index as string}\n`;
  if (r.skill_md)    out += `${ind}${pc.dim('skill_md:')} ${r.skill_md as string}\n`;
  if (Array.isArray(r.capabilities) && r.capabilities.length > 0) {
    out += `${ind}${pc.dim('caps:')}     ${(r.capabilities as string[]).join(', ')}\n`;
  }
  if (Array.isArray(r.tools) && r.tools.length > 0) {
    out += `${ind}${pc.dim('tools:')}    ${(r.tools as Array<{ name: string }>).map(t => t.name).join(', ')}\n`;
  }
  return out;
}
