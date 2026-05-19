/**
 * `agent-root completion <shell>` — emit a shell completion script to stdout
 * so users can install it with a one-line redirection. Pattern lifted from
 * gh, deno, vitest, pnpm.
 *
 * The completion scripts are intentionally STATIC. The CLI surface (commands
 * + flags) is small and changes rarely; on every change, the constants in
 * this file get updated alongside the router. Keeping the scripts static
 * means tab-completion is instant and works offline (no subshell invocation
 * of the CLI itself to enumerate commands).
 *
 * Supported shells: bash, zsh, fish, powershell (alias `pwsh`).
 */
import { fatal } from '../cli/fatal';
import { EXIT } from '../cli/exit-codes';
import { colors } from '../cli/colors';

// Local copy of the `section()` helper that lives in help.ts. Duplicated
// rather than re-exported because the completion page is the only
// non-help file that uses it, and exporting it would force help.ts to
// reorder its private helpers above its public exports.
function section(title: string): string {
  return colors.bold(title);
}

// Top-level commands the completer offers as the first arg. Includes the
// short aliases users actually type (`r`, `i`, `s`, `ls`, `up`, `rm`).
// Kept in sync with the switch in src/index.ts::main().
const COMMANDS = [
  'resolve', 'r',
  'search', 's',
  'install', 'i',
  'list', 'ls',
  'update', 'up',
  'uninstall', 'rm', 'remove',
  'init',
  'validate',
  'config',
  'health',
  'manifests',
  'collections',
  'submit',
  'version',
  'completion',
  'help',
];

// Top-level flags. Kept short on purpose: tab-completion is most useful for
// the few most-common flags; over-listing reduces discoverability.
const FLAGS = [
  '--help', '-h',
  '--version', '-v',
  '--json', '-j',
  '--yes', '-y',
  '--force', '-f',
  '--quiet', '-q',
  '--no-color',
  '--tool',
  '--type',
  '--project',
  '--all',
  '--page',
  '--limit',
  '--domain',
  '--query',
  '--manifest-url',
  '--no-install',
];

// Argument-value enums offered for --tool and --type.
const TOOLS = ['claude', 'cursor', 'codex', 'gemini', 'agents'];
const TYPES = ['agent', 'mcp', 'skill', 'a2a', 'payment'];
const SHELLS = ['bash', 'zsh', 'fish', 'powershell', 'pwsh'];

export function cmdCompletion(positional: string[], _flags: Record<string, unknown>): void {
  const shell = positional[0];
  if (!shell) {
    fatal('Missing shell argument.', 'Usage: agent-root completion <bash|zsh|fish|powershell>', EXIT.USAGE);
  }
  switch (shell) {
    case 'bash':
      process.stdout.write(bashScript());
      return;
    case 'zsh':
      process.stdout.write(zshScript());
      return;
    case 'fish':
      process.stdout.write(fishScript());
      return;
    case 'powershell':
    case 'pwsh':
      process.stdout.write(powershellScript());
      return;
    default:
      fatal(
        `Unknown shell: ${shell}. Supported: bash, zsh, fish, powershell`,
        EXIT.USAGE,
      );
  }
}

function bashScript(): string {
  const cmds = COMMANDS.join(' ');
  const opts = FLAGS.join(' ');
  const tools = TOOLS.join(' ');
  const types = TYPES.join(' ');
  return `# bash completion for agent-root
# Install with:
#   agent-root completion bash > /usr/local/etc/bash_completion.d/agent-root
# or source it in ~/.bashrc:
#   source <(agent-root completion bash)

_agent_root() {
  local cur prev cmds opts
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  cmds="${cmds}"
  opts="${opts}"

  if [ "\$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "\$cmds" -- "\$cur") )
    return 0
  fi
  case "\$prev" in
    --tool) COMPREPLY=( $(compgen -W "${tools}" -- "\$cur") ); return 0 ;;
    --type) COMPREPLY=( $(compgen -W "${types}" -- "\$cur") ); return 0 ;;
    completion) COMPREPLY=( $(compgen -W "bash zsh fish powershell pwsh" -- "\$cur") ); return 0 ;;
  esac
  if [[ "\$cur" == -* ]]; then
    COMPREPLY=( $(compgen -W "\$opts" -- "\$cur") )
  fi
}
complete -F _agent_root agent-root
complete -F _agent_root agentroot
`;
}

function zshScript(): string {
  // zsh completion using _arguments + _describe. Lives in a function the
  // user sources or drops into $fpath as `_agent-root`.
  const cmdDescriptions = [
    'resolve:DNS lookup, fetch manifest, list records',
    'r:alias for resolve',
    'search:Search the AgentRoot registry',
    's:alias for search',
    'install:Install a record (skill or MCP)',
    'i:alias for install',
    'list:Show installed records',
    'ls:alias for list',
    'update:Re-fetch installed records from source',
    'up:alias for update',
    'uninstall:Remove an installed record',
    'rm:alias for uninstall',
    'remove:alias for uninstall',
    'init:Scaffold a manifest',
    'validate:Validate a manifest',
    'config:View or set CLI configuration',
    'health:Probe the registry API',
    'manifests:List registered manifests',
    'collections:Browse curated collections',
    'submit:Submit a domain to the public registry',
    'version:Print version + runtime + config info',
    'completion:Print shell completion script',
    'help:Show usage',
  ].map(s => `    '${s}'`).join(' \\\n');

  return `#compdef agent-root agentroot
# zsh completion for agent-root
# Install with:
#   agent-root completion zsh > "\${fpath[1]}/_agent-root"
# Then restart your shell (or run \`compinit\`).

_agent-root() {
  local -a commands
  commands=(
${cmdDescriptions}
  )

  _arguments -C \\
    '(-h --help)'{-h,--help}'[Show help]' \\
    '(-v --version)'{-v,--version}'[Print CLI version]' \\
    '(-j --json)'{-j,--json}'[Output as JSON]' \\
    '(-y --yes)'{-y,--yes}'[Auto-confirm prompts]' \\
    '(-f --force)'{-f,--force}'[Overwrite existing files]' \\
    '(-q --quiet)'{-q,--quiet}'[Suppress non-essential output]' \\
    '--no-color[Disable ANSI color]' \\
    '--tool[Target tool]:tool:(${TOOLS.join(' ')})' \\
    '--type[Filter by record type]:type:(${TYPES.join(' ')})' \\
    '--project[Install to project directory]' \\
    '--all[Install all records / fetch every page]' \\
    '--page[Page number]:page' \\
    '--limit[Per-page limit]:limit' \\
    '--domain[Domain name for init template]:domain' \\
    '--query[Free-text filter for manifests]:query' \\
    '--manifest-url[Explicit manifest URL]:url' \\
    '--no-install[Skip auto-install of skill records]' \\
    '1: :->command' \\
    '*: :->args'

  case "\$state" in
    command)
      _describe 'command' commands
      ;;
    args)
      case "\$words[2]" in
        completion)
          _values 'shell' bash zsh fish powershell pwsh
          ;;
      esac
      ;;
  esac
}

compdef _agent-root agent-root agentroot
`;
}

function fishScript(): string {
  const lines: string[] = [
    '# fish completion for agent-root',
    '# Install with:',
    '#   agent-root completion fish > ~/.config/fish/completions/agent-root.fish',
    '',
    '# Disable file completion by default; commands and enums are explicit.',
    'complete -c agent-root -f',
    'complete -c agentroot -f',
    '',
  ];
  // First-arg command suggestions
  const commandDescriptions: Record<string, string> = {
    resolve: 'DNS lookup, fetch manifest, list records',
    search: 'Search the AgentRoot registry',
    install: 'Install a record (skill or MCP)',
    list: 'Show installed records',
    update: 'Re-fetch installed records from source',
    uninstall: 'Remove an installed record',
    init: 'Scaffold a manifest',
    validate: 'Validate a manifest',
    config: 'View or set CLI configuration',
    health: 'Probe the registry API',
    manifests: 'List registered manifests',
    collections: 'Browse curated collections',
    submit: 'Submit a domain to the public registry',
    version: 'Print version + runtime + config info',
    completion: 'Print shell completion script',
    help: 'Show usage',
  };
  for (const [cmd, desc] of Object.entries(commandDescriptions)) {
    lines.push(`complete -c agent-root -n "__fish_use_subcommand" -a "${cmd}" -d "${desc}"`);
    lines.push(`complete -c agentroot  -n "__fish_use_subcommand" -a "${cmd}" -d "${desc}"`);
  }
  lines.push('');
  // Top-level flag completions
  lines.push('# Top-level flags');
  lines.push('complete -c agent-root -l help    -s h -d "Show help"');
  lines.push('complete -c agent-root -l version -s v -d "Print CLI version"');
  lines.push('complete -c agent-root -l json    -s j -d "Output as JSON"');
  lines.push('complete -c agent-root -l yes     -s y -d "Auto-confirm prompts"');
  lines.push('complete -c agent-root -l force   -s f -d "Overwrite existing files"');
  lines.push('complete -c agent-root -l quiet   -s q -d "Suppress non-essential output"');
  lines.push('complete -c agent-root -l no-color    -d "Disable ANSI color"');
  lines.push('complete -c agent-root -l project     -d "Install to project directory"');
  lines.push('complete -c agent-root -l all         -d "Install all records"');
  lines.push('complete -c agent-root -l no-install  -d "Skip auto-install"');
  lines.push(`complete -c agent-root -l tool   -d "Target tool" -xa "${TOOLS.join(' ')}"`);
  lines.push(`complete -c agent-root -l type   -d "Filter by record type" -xa "${TYPES.join(' ')}"`);
  lines.push('complete -c agent-root -l page         -d "Page number"   -x');
  lines.push('complete -c agent-root -l limit        -d "Per-page limit" -x');
  lines.push('complete -c agent-root -l domain       -d "Domain name"   -x');
  lines.push('complete -c agent-root -l query        -d "Free-text filter" -x');
  lines.push('complete -c agent-root -l manifest-url -d "Explicit manifest URL" -x');
  lines.push('');
  lines.push('# Completion subcommand: offer shell names');
  lines.push(`complete -c agent-root -n "__fish_seen_subcommand_from completion" -fa "${SHELLS.join(' ')}"`);
  lines.push(`complete -c agentroot  -n "__fish_seen_subcommand_from completion" -fa "${SHELLS.join(' ')}"`);
  return lines.join('\n') + '\n';
}

function powershellScript(): string {
  return `# PowerShell completion for agent-root
# Install with:
#   agent-root completion pwsh > $PROFILE.CurrentUserAllHosts/agent-root.ps1
# or paste into your $PROFILE directly.

Register-ArgumentCompleter -Native -CommandName agent-root,agentroot -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)

    $commands = @(${COMMANDS.map(c => `'${c}'`).join(', ')})
    $flags = @(${FLAGS.map(f => `'${f}'`).join(', ')})
    $tools = @(${TOOLS.map(t => `'${t}'`).join(', ')})
    $types = @(${TYPES.map(t => `'${t}'`).join(', ')})
    $shells = @(${SHELLS.map(s => `'${s}'`).join(', ')})

    $tokens = $commandAst.CommandElements
    $tokenCount = $tokens.Count
    $prev = if ($tokenCount -ge 2) { $tokens[$tokenCount - 2].Value } else { '' }

    if ($tokenCount -le 1) {
        $commands | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
            [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
        }
        return
    }

    switch ($prev) {
        '--tool' { $tools | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
            [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }; return }
        '--type' { $types | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
            [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }; return }
        'completion' { $shells | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
            [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }; return }
    }

    if ($wordToComplete.StartsWith('-')) {
        $flags | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
            [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterName', $_)
        }
    }
}
`;
}

export function helpCompletion(): void {
  // Reuses the same `section()` helper as the other per-command help pages
  // so the styling matches.
  const body = `${section('agentroot completion')} - Print a shell completion script

${section('USAGE')}
  agentroot completion <shell>

${section('DESCRIPTION')}
  Emits a shell completion script for the given shell to stdout. Source it
  in your shell startup, or redirect it to the file your shell loads on
  startup. Supported shells: bash, zsh, fish, powershell (alias: pwsh).

${section('EXAMPLES')}
  # bash
  agent-root completion bash > /usr/local/etc/bash_completion.d/agent-root

  # zsh
  agent-root completion zsh > "\${fpath[1]}/_agent-root"

  # fish
  agent-root completion fish > ~/.config/fish/completions/agent-root.fish

  # powershell
  agent-root completion pwsh > $PROFILE.CurrentUserAllHosts/agent-root.ps1

${section('EXIT CODES')}
  0   Script printed
  2   Unknown or missing shell (USAGE)`;
  // Trailing newline keeps `<cmd> --help | head -1` showing the title row.
  console.log(body.trimEnd() + '\n');
}
