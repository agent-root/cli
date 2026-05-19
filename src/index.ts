// IMPORTANT: env-preamble must be the very first import. It mutates
// `process.env` so picocolors/nanospinner see the right color setting when
// they evaluate `isColorSupported` at their own module-load time. Moving this
// even one line later silently re-enables color under CI=true and similar.
import './cli/env-preamble';
import { colors, configureColors } from './cli/colors';
import { configureQuiet } from './cli/streams';
import { configureJsonMode } from './cli/fatal';
import { EXIT } from './cli/exit-codes';
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
import { cmdCompletion, helpCompletion } from './commands/completion';
import {
  helpResolve, helpSearch, helpInstall, helpList, helpUpdate, helpUninstall,
  helpInit, helpValidate, helpConfig, helpStats, helpHealth, helpManifests,
  helpCollections, helpSubmit, helpVersion,
} from './commands/help';
import { parseArgs, applyEnvDefaults } from './cli/parse-args';
import { fatal } from './cli/fatal';
import { DOCS_URL } from './constants/protocol';

/**
 * Map of command (and its aliases) to its per-command help printer.
 * Looked up in main() when `flags.help` is set and `cmd` is non-empty.
 * Order matters in main(): the global help check must come AFTER the
 * `cmd === 'help'` global page so `agent-root help` still works.
 */
const PER_COMMAND_HELP: Record<string, () => void> = {
  resolve: helpResolve, r: helpResolve,
  search: helpSearch, s: helpSearch,
  install: helpInstall, i: helpInstall,
  list: helpList, ls: helpList,
  update: helpUpdate, up: helpUpdate,
  uninstall: helpUninstall, rm: helpUninstall, remove: helpUninstall,
  init: helpInit,
  validate: helpValidate,
  config: helpConfig,
  stats: helpStats,
  health: helpHealth,
  manifests: helpManifests,
  collections: helpCollections,
  submit: helpSubmit,
  version: helpVersion,
  completion: helpCompletion,
};

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

${colors.bold('TOOLING')}
  ${colors.cyan('version')}                            Print version + runtime + config info
  ${colors.cyan('completion')} <shell>                 Print shell completion (bash, zsh, fish, pwsh)

  Run ${colors.cyan('agent-root <command> --help')} for command-specific flags and exit codes.

${colors.bold('OPTIONS')}
  --help, -h         Show this help (or per-command help after a command name)
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
  --quiet, -q        Suppress non-essential output (spinners + notes)
  --no-install       Skip auto-install when resolving skill= records
  --no-color         Disable ANSI color (also auto-off in non-TTY)

  Flag names accept both kebab-case (--manifest-url) and camelCase (--manifestUrl).
  Use --key=value or --key value. Use -- to end option parsing.

${colors.bold('ENVIRONMENT')}
  NO_COLOR=1               Disable ANSI color (no-color.org standard)
  CI=true                  Imply --yes and --no-color (no prompts, plain text)
  AGENTROOT_YES=1          Imply --yes
  AGENTROOT_JSON=1         Imply --json
  AGENTROOT_NO_COLOR=1     Imply --no-color (namespaced variant)
  AGENTROOT_API_BASE=<url> Override the registry API base

  Spinners, comments, and progress chatter all go to stderr, so
  \`agent-root <cmd> --json | jq\` works without redirecting 2>/dev/null.

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

  ${colors.dim('# Set up shell completion')}
  npx agent-root completion zsh > "\${fpath[1]}/_agent-root"

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

  // Wire color, quiet, and JSON-mode state from flags + env *before* anything
  // writes output. Done in this exact order so showHelp(), the version printer,
  // and every command see consistent behavior. configureJsonMode lets fatal()
  // emit a JSON error envelope on stdout when --json is set.
  configureColors(flags);
  configureQuiet(flags);
  configureJsonMode(flags);

  // `--version` / `-v` short-circuit, no DB/network side effects.
  if (flags.version && cmd === undefined) {
    printShortVersion();
    return;
  }

  // `agent-root help` is the global usage page. Goes first so it always wins.
  if (cmd === 'help') {
    showHelp();
    return;
  }

  // `agent-root <cmd> --help` drills into the per-command page. We check this
  // BEFORE the bare `--help` global so users get the specific page when both
  // a command and the flag are present. Falls through to global help if the
  // command doesn't have a dedicated page (shouldn't happen, but safe).
  if (flags.help && cmd && PER_COMMAND_HELP[cmd]) {
    PER_COMMAND_HELP[cmd]();
    return;
  }

  if (flags.help) {
    showHelp();
    return;
  }

  if (!cmd) {
    if (isTTY && !flags.json) {
      await promptSearch(flags);
      return;
    }
    // Non-interactive / piped invocation with no command is a script error,
    // not a help request. Print usage to stderr and exit with USAGE so
    // shell scripts treat `agent-root | foo` as the bug it is.
    showHelp();
    process.exit(EXIT.USAGE);
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
      case 'completion':
        cmdCompletion(positional, flags);
        break;
      default:
        fatal(`Unknown command: ${cmd}. Run "agentroot help" for usage.`, EXIT.USAGE);
    }
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    // Map low-level OS / DNS / network errno onto sysexits-style codes so
    // shell scripts can branch on the failure mode. ENOTFOUND + EAI_AGAIN
    // indicate the DNS name didn't resolve at all (NOHOST). ECONNREFUSED
    // is a reachable host that closed the door (UNAVAILABLE). EACCES is
    // a permissions denial during fs writes (NOPERM, see install/uninstall).
    if (e.code === 'ENOTFOUND' || e.code === 'EAI_AGAIN') {
      fatal('Could not resolve agentroot.io.', 'Check your DNS or try again in a moment.', EXIT.NOHOST);
    }
    if (e.code === 'ECONNREFUSED') {
      fatal('Could not connect to agentroot.io.', 'The registry may be down. Try again in a moment.', EXIT.UNAVAILABLE);
    }
    if (e.code === 'EACCES' || e.code === 'EPERM') {
      fatal(e.message, 'Check file permissions for ~/.agentroot and ~/.claude/skills.', EXIT.NOPERM);
    }
    fatal(e.message, 'Run with --json for machine-readable output, or report at https://github.com/d3-inc/agentroot/issues');
  }
}
