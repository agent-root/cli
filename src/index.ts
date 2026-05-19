// IMPORTANT: env-preamble must be the very first import. It mutates
// `process.env` so picocolors/nanospinner see the right color setting when
// they evaluate `isColorSupported` at their own module-load time. Moving this
// even one line later silently re-enables color under CI=true and similar.
import './cli/env-preamble';
import { colors, configureColors } from './cli/colors';
import { configureQuiet } from './cli/streams';
import { cmdResolve } from './commands/resolve';
import { cmdInstall } from './commands/install';
import { cmdSearch, promptSearch } from './commands/search';
import { cmdList } from './commands/list';
import { cmdUpdate } from './commands/update';
import { cmdUninstall } from './commands/uninstall';
import { cmdInit } from './commands/init';
import { cmdValidate } from './commands/validate';
import { cmdConfig } from './commands/config';
import { cmdStats } from './commands/stats';
import { cmdHealth } from './commands/health';
import { cmdManifests } from './commands/manifests';
import { cmdCollections } from './commands/collections';
import { cmdSubmit } from './commands/submit';
import { cmdVersion, printShortVersion } from './commands/version';
import { parseArgs, applyEnvDefaults } from './cli/parse-args';
import { fatal } from './cli/fatal';
import { DOCS_URL } from './constants/protocol';

export function showHelp(): void {
  console.log(`
${colors.bold('agentroot')}: CLI for the AgentRoot protocol

${colors.bold('USAGE')}
  npx agent-root <command> [options]

${colors.bold('DISCOVER')}
  ${colors.cyan('resolve')}  <domain>[/<record-id>]  DNS lookup → fetch manifest → show records (auto-installs skills)
  ${colors.cyan('search')}   <query>                  Search the AgentRoot registry

${colors.bold('INSTALL')}
  ${colors.cyan('install')}   <domain>/<record-id>    Install a record (skill or MCP)
  ${colors.cyan('list')}                              Show installed records
  ${colors.cyan('update')}    <domain>/<record-id>    Re-fetch from source
  ${colors.cyan('uninstall')} <record-id>             Remove an installed record

${colors.bold('PUBLISH')}
  ${colors.cyan('init')}     [path]                   Scaffold a manifest
  ${colors.cyan('validate')} [path]                   Validate a manifest
  ${colors.cyan('submit')}   <domain>                 Submit a domain to the public registry

${colors.bold('REGISTRY')}
  ${colors.cyan('stats')}                              Registry counts (agents, skills, by TLD)
  ${colors.cyan('health')}                             Probe the registry API
  ${colors.cyan('manifests')} [--query <q>]            List registered manifests
  ${colors.cyan('collections')} [<slug>]               Browse curated collections
  ${colors.cyan('version')}                            Print version + runtime + config info

${colors.bold('OPTIONS')}
  --help, -h         Show this help
  --version, -v      Print CLI version (one line)
  --tool <name>      Target tool: claude, codex, gemini, cursor, agents
  --type <type>      Filter by record type: agent, mcp, skill, a2a, payment
  --project          Install to project directory (not global)
  --all              Install all records (or fetch every search/manifests page)
  --page <N>         Page number for search/manifests (1-indexed, default 1)
  --limit <N>        Per-page limit (1..100, default 20)
  --json, -j         Output as JSON
  --domain <name>    Domain name for init template
  --query <q>        Free-text filter for manifests
  --manifest-url     Explicit manifest URL for submit
  --yes, -y          Auto-confirm all prompts (for CI/scripts)
  --force, -f        Overwrite existing files
  --quiet, -q        Suppress non-essential output
  --no-install       Skip auto-install when resolving skill= records

  Flag names accept both kebab-case (--manifest-url) and camelCase (--manifestUrl).
  Use --key=value or --key value. Use -- to end option parsing.

${colors.bold('EXAMPLES')}
  ${colors.dim('# Resolve a domain\'s capabilities directly via DNS')}
  npx agent-root resolve doma.xyz
  npx agent-root resolve doma.xyz/doma-protocol

  ${colors.dim('# Search the public registry')}
  npx agent-root search doma
  npx agent-root search "register domain" --type skill

  ${colors.dim('# Install a record')}
  npx agent-root install doma.xyz/doma-protocol --tool claude

  ${colors.dim('# Publish your own manifest')}
  npx agent-root init --domain mycompany.com
  npx agent-root validate .well-known/agentroot.json
  npx agent-root submit mycompany.com

  ${colors.dim('# Browse the registry')}
  npx agent-root stats
  npx agent-root manifests --query doma
  npx agent-root collections featured-domains

  ${colors.dim('# Bug report? Paste this first.')}
  npx agent-root version

${colors.bold('PROTOCOL')}
  AgentRoot resolves AI capabilities via DNS TXT records + JSON manifests.
  Any domain can declare agents, MCP servers, skills, and A2A endpoints.
  See: ${DOCS_URL}
`);
}

export async function main(): Promise<void> {
  const isTTY = !!process.stdout.isTTY;
  const { cmd, positional, flags } = parseArgs(process.argv);

  // Apply env-based defaults (CI, AGENTROOT_YES/JSON/NO_COLOR, NO_COLOR) before
  // anything reads from flags. Explicit CLI flags still win — this only fills
  // in unset keys, matching 12-Factor #6 ("Config in env").
  applyEnvDefaults(flags);

  // Wire color and quiet state from flags + env *before* anything writes output.
  // Done in this exact order so showHelp(), the version printer, and every
  // command see consistent behavior.
  configureColors(flags);
  configureQuiet(flags);

  // `--version` / `-v` short-circuit, no DB/network side effects.
  if (flags.version && cmd === undefined) {
    printShortVersion();
    return;
  }

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
  const { ensureDefaults } = await import('./services/config/defaults.js');
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
      case 'stats':
        await cmdStats(positional, flags);
        break;
      case 'health':
        await cmdHealth(positional, flags);
        break;
      case 'manifests':
        await cmdManifests(positional, flags);
        break;
      case 'collections':
        await cmdCollections(positional, flags);
        break;
      case 'submit':
        await cmdSubmit(positional, flags);
        break;
      case 'version':
        cmdVersion(positional, flags);
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
