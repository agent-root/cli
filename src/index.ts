import pc from 'picocolors';
import { cmdResolve } from './commands/resolve';
import { cmdInstall } from './commands/install';
import { cmdSearch, promptSearch } from './commands/search';
import { cmdList } from './commands/list';
import { cmdUpdate } from './commands/update';
import { cmdUninstall } from './commands/uninstall';
import { cmdInit } from './commands/init';
import { cmdValidate } from './commands/validate';
import { cmdConfig } from './commands/config';
import { parseArgs, fatal } from './lib/format';

export function showHelp(): void {
  console.log(`
${pc.bold('agentroot')} — CLI for the AgentRoot protocol

${pc.bold('USAGE')}
  npx agent-root <command> [options]

${pc.bold('DISCOVER')}
  ${pc.cyan('resolve')}  <domain>[/<record-id>]  DNS lookup → fetch manifest → show records (auto-installs skills)
  ${pc.cyan('search')}   <query>                  Search the AgentRoot registry

${pc.bold('INSTALL')}
  ${pc.cyan('install')}   <domain>/<record-id>    Install a record (skill or MCP)
  ${pc.cyan('list')}                              Show installed records
  ${pc.cyan('update')}    <domain>/<record-id>    Re-fetch from source
  ${pc.cyan('uninstall')} <record-id>             Remove an installed record

${pc.bold('PUBLISH')}
  ${pc.cyan('init')}     [path]                   Scaffold a manifest
  ${pc.cyan('validate')} [path]                   Validate a manifest

${pc.bold('OPTIONS')}
  --tool <name>    Target tool: claude, codex, gemini, cursor, agents
  --type <type>    Filter by record type: agent, mcp, skill, a2a, payment
  --project        Install to project directory (not global)
  --all            Install all records from a domain
  --json           Output as JSON
  --domain <name>  Domain name for init template
  --yes            Auto-confirm all prompts (for CI/scripts)
  --force          Overwrite existing files
  --no-install     Skip auto-install when resolving skill= records

${pc.bold('EXAMPLES')}
  ${pc.dim('# Resolve a domain\'s capabilities directly via DNS')}
  npx agent-root resolve stripe.com
  npx agent-root resolve stripe.com/payments

  ${pc.dim('# Search the registry')}
  npx agent-root search "database" --type mcp
  npx agent-root search "deploy"

  ${pc.dim('# Install a record')}
  npx agent-root install stripe.com/payments --tool claude

  ${pc.dim('# Publish your own manifest')}
  npx agent-root init --domain mycompany.com
  npx agent-root validate .well-known/agentroot.json

${pc.bold('PROTOCOL')}
  AgentRoot resolves AI capabilities via DNS TXT records + JSON manifests.
  Any domain can declare agents, MCP servers, skills, and A2A endpoints.
  See: https://agentroot.io/docs/protocol
`);
}

export async function main(): Promise<void> {
  const isTTY = !!process.stdout.isTTY;
  const { cmd, positional, flags } = parseArgs(process.argv);

  if (flags.help || cmd === 'help') {
    showHelp();
    return;
  }

  if (!cmd) {
    if (isTTY && !flags.json) {
      await promptSearch(flags);
      return;
    }
    showHelp();
    return;
  }

  // Install default skills on first run (non-blocking, silent on failure)
  const { ensureDefaults } = await import('./lib/defaults.js');
  await ensureDefaults(flags);

  try {
    switch (cmd) {
      case 'resolve': case 'r':
        await cmdResolve(positional, flags);
        break;
      case 'install': case 'i':
        await cmdInstall(positional, flags);
        break;
      case 'search': case 's':
        await cmdSearch(positional, flags);
        break;
      case 'list': case 'ls':
        await cmdList(positional, flags);
        break;
      case 'update': case 'up':
        await cmdUpdate(positional, flags);
        break;
      case 'uninstall': case 'rm': case 'remove':
        await cmdUninstall(positional, flags);
        break;
      case 'init':
        await cmdInit(positional, flags);
        break;
      case 'validate':
        await cmdValidate(positional, flags);
        break;
      case 'config':
        await cmdConfig(positional, flags);
        break;
      default:
        fatal(`Unknown command: ${cmd}. Run "agentroot help" for usage.`);
    }
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOTFOUND' || e.code === 'ECONNREFUSED') {
      fatal('Could not connect to agentroot.io.', 'Check your internet connection or try again in a moment.');
    }
    fatal(e.message, 'Run with --json for machine-readable output, or report at https://github.com/d3-inc/agentroot/issues');
  }
}
