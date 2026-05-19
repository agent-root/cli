/**
 * Per-command --help pages. One function per command, each prints a focused
 * page (description, usage, applicable flags, 2-3 examples, exit codes).
 *
 * Kept in a single file so the structure stays consistent across commands
 * and the global flag table doesn't drift out of sync between pages.
 *
 * Wired in src/index.ts: `agent-root <cmd> --help` → call <cmd> from the
 * PER_COMMAND_HELP map, then return. `agent-root --help` and the bare
 * `help` subcommand still hit the global showHelp().
 */
import { colors } from '../cli/colors';

function section(title: string): string {
  return colors.bold(title);
}

function page(body: string): void {
  // Trailing newline so the next shell prompt isn't glued to the last line.
  // No leading blank — keeps `<cmd> --help | head -1` showing the title row
  // (which is the standard smoke-test for "did per-command help work?").
  console.log(body.trimEnd() + '\n');
}

export function helpResolve(): void {
  page(`${section('agentroot resolve')} - Look up a domain via DNS and list its capabilities

${section('USAGE')}
  agentroot resolve <domain>[/<record-id>] [options]

${section('DESCRIPTION')}
  Issues a DNS TXT query for _agentroot.<domain>, parses the manifest URL
  from the v=ar1 record, fetches the JSON manifest over HTTPS, and lists
  every record the domain publishes. If a /<record-id> is given, filters
  to just that record. Skill records auto-install by default.

${section('OPTIONS')}
  --json, -j        Output as JSON envelope
  --no-install      Skip auto-install of skill= records
  --no-color        Disable ANSI color
  --quiet, -q       Suppress progress chatter

${section('EXAMPLES')}
  agentroot resolve doma.xyz
  agentroot resolve doma.xyz/doma-protocol
  agentroot resolve doma.xyz --json | jq '.records[].address'

${section('EXIT CODES')}
  0   Found records
  68  No _agentroot TXT record (NOHOST)
  69  Manifest fetch failed (UNAVAILABLE)
  76  Manifest fails protocol validation (PROTOCOL)`);
}

export function helpSearch(): void {
  page(`${section('agentroot search')} - Search the AgentRoot registry

${section('USAGE')}
  agentroot search <query> [options]

${section('DESCRIPTION')}
  Queries the registry's /api/records endpoint with free-text search. Type
  filters narrow by record kind. Pagination is server-side; use --page /
  --limit to walk results, or --all to collect every match (capped at 1000).

${section('OPTIONS')}
  --type <type>     Filter by record type: agent, mcp, skill, a2a, payment
  --page <N>        Page number (1-indexed, default 1)
  --limit <N>       Per-page limit (1..100, default 20)
  --all             Fetch every page (hard-capped at 1000)
  --json, -j        Output as JSON envelope
  --no-color        Disable ANSI color
  --quiet, -q       Suppress progress chatter

${section('EXAMPLES')}
  agentroot search billing
  agentroot search "register domain" --type skill
  agentroot search doma --limit 5 --json | jq '.results[].address'

${section('EXIT CODES')}
  0   Search completed (even if zero results)
  2   Missing query argument (USAGE)
  69  Registry unreachable (UNAVAILABLE)`);
}

export function helpInstall(): void {
  page(`${section('agentroot install')} - Install a skill or MCP record

${section('USAGE')}
  agentroot install <domain>/<record-id> [options]
  agentroot install <domain> --all [options]

${section('DESCRIPTION')}
  Resolves the domain via DNS (falls back to the registry), downloads the
  record's payload, and links/copies it into your AI tool's skills
  directory. Skill records become SKILL.md files; MCP records print a
  config snippet you paste into your MCP client.

${section('OPTIONS')}
  --tool <name>     Target tool: claude, codex, gemini, cursor, agents
  --project         Install into the project directory, not global
  --all             Install every record at the given domain
  --json, -j        Output as JSON envelope
  --yes, -y         Auto-confirm prompts (CI mode)
  --no-color        Disable ANSI color
  --quiet, -q       Suppress progress chatter

${section('EXAMPLES')}
  agentroot install doma.xyz/doma-protocol --tool claude
  agentroot install nameyard.io --all --tool claude
  agentroot install rides.com/payments --project

${section('EXIT CODES')}
  0   Installed successfully
  2   Bad/missing arguments (USAGE)
  68  Domain not found in DNS or registry (NOHOST)
  69  Registry unreachable (UNAVAILABLE)
  77  Permission denied writing to ~/.agents (NOPERM)`);
}

export function helpList(): void {
  page(`${section('agentroot list')} - Show installed records

${section('USAGE')}
  agentroot list [options]
  agentroot ls

${section('DESCRIPTION')}
  Reads ~/.agentroot/installed.json and prints every record this CLI has
  installed locally: its domain, record id, type, tool linkage, install
  time, and version hash.

${section('OPTIONS')}
  --json, -j        Output as JSON envelope
  --no-color        Disable ANSI color
  --quiet, -q       Suppress progress chatter

${section('EXAMPLES')}
  agentroot list
  agentroot list --json | jq '.records[].key'

${section('EXIT CODES')}
  0   Always (even with zero installs)`);
}

export function helpUpdate(): void {
  page(`${section('agentroot update')} - Re-fetch installed records from source

${section('USAGE')}
  agentroot update [<domain>/<record-id>] [options]
  agentroot up

${section('DESCRIPTION')}
  Without an argument, re-fetches every installed record's source_url in
  parallel and updates the canonical copy + any per-tool copies. With an
  argument, updates just that record. Symlinked tool installations pick up
  changes automatically once the canonical is rewritten.

${section('OPTIONS')}
  --json, -j        Output as JSON envelope
  --no-color        Disable ANSI color
  --quiet, -q       Suppress progress chatter

${section('EXAMPLES')}
  agentroot update
  agentroot update doma.xyz/doma-protocol
  agentroot update --json | jq '.records[] | select(.status=="updated")'

${section('EXIT CODES')}
  0   Update completed (some records may individually have failed)
  2   Bad argument shape (USAGE)
  69  Source URL unreachable (UNAVAILABLE)
  78  Installed record missing source_url (CONFIG)`);
}

export function helpUninstall(): void {
  page(`${section('agentroot uninstall')} - Remove an installed record

${section('USAGE')}
  agentroot uninstall <domain>/<record-id> [options]
  agentroot rm <domain>/<record-id>

${section('DESCRIPTION')}
  Removes the canonical copy from ~/.agents/skills and every tool-specific
  symlink/copy. With no argument in a TTY, opens an interactive picker;
  in non-TTY contexts (CI, pipes), requires an explicit record id.

${section('OPTIONS')}
  --yes, -y         Auto-confirm the destructive prompt
  --json, -j        Output as JSON envelope
  --no-color        Disable ANSI color
  --quiet, -q       Suppress progress chatter

${section('EXAMPLES')}
  agentroot uninstall nameyard.io/nameyard-billing
  agentroot uninstall doma.xyz/doma-protocol --yes
  agentroot uninstall   # interactive picker

${section('EXIT CODES')}
  0   Removed (or already absent)
  2   Bad argument shape (USAGE)
  77  Permission denied removing files (NOPERM)`);
}

export function helpInit(): void {
  page(`${section('agentroot init')} - Scaffold a manifest

${section('USAGE')}
  agentroot init [path] [options]

${section('DESCRIPTION')}
  Writes a minimal .well-known/agentroot.json template (or the path you
  provide) with one example MCP record so the file passes validation as
  written. Prints next-step instructions including the DNS TXT record to
  publish and the submit command.

${section('OPTIONS')}
  --domain <name>   Domain name to use in the template (default: yourdomain.com)
  --force, -f       Overwrite the file if it already exists
  --no-color        Disable ANSI color
  --quiet, -q       Suppress progress chatter

${section('EXAMPLES')}
  agentroot init --domain mycompany.com
  agentroot init ./manifest.json --force
  agentroot init  # writes .well-known/agentroot.json

${section('EXIT CODES')}
  0   Template written
  66  Output file exists and --force was not passed (NOINPUT)
  77  Permission denied writing the file (NOPERM)`);
}

export function helpValidate(): void {
  page(`${section('agentroot validate')} - Validate a manifest

${section('USAGE')}
  agentroot validate [path] [options]

${section('DESCRIPTION')}
  Reads the manifest at <path> (default .well-known/agentroot.json), parses
  it as JSON, and checks every record against the AgentRoot protocol
  schema. Prints a record-type breakdown on success, or the list of
  schema errors on failure.

${section('OPTIONS')}
  --json, -j        Output as JSON envelope
  --no-color        Disable ANSI color
  --quiet, -q       Suppress progress chatter

${section('EXAMPLES')}
  agentroot validate
  agentroot validate ./.well-known/agentroot.json
  agentroot validate manifest.json --json | jq '.valid'

${section('EXIT CODES')}
  0   Valid manifest
  66  File not found (NOINPUT)
  76  Invalid JSON or schema violation (PROTOCOL)
  77  Permission denied reading the file (NOPERM)`);
}

export function helpConfig(): void {
  page(`${section('agentroot config')} - View or set CLI configuration

${section('USAGE')}
  agentroot config get [options]
  agentroot config set <key> <value> [options]

${section('DESCRIPTION')}
  Reads/writes ~/.agentroot/config.json. The most commonly-set key is
  api-url, which overrides the registry endpoint (handy for self-hosted
  registries or local development against a Vercel preview).

${section('OPTIONS')}
  --no-color        Disable ANSI color
  --quiet, -q       Suppress progress chatter

${section('EXAMPLES')}
  agentroot config get
  agentroot config set api-url http://localhost:4747
  agentroot config set api-url https://www.agentroot.io

${section('EXIT CODES')}
  0   Read/write succeeded
  2   Unknown subcommand or missing key/value (USAGE)`);
}

export function helpHealth(): void {
  page(`${section('agentroot health')} - Probe the registry API

${section('USAGE')}
  agentroot health [options]

${section('DESCRIPTION')}
  Probes /api/health and reports whether the registry is up and its
  database is reachable. Exit 0 only when status=ok and db=connected;
  any other state is reported as degraded with a non-zero exit.

${section('OPTIONS')}
  --json, -j        Output as JSON envelope
  --no-color        Disable ANSI color
  --quiet, -q       Suppress progress chatter

${section('EXAMPLES')}
  agentroot health
  agentroot health --json | jq '.status'

${section('EXIT CODES')}
  0   Registry healthy
  68  DNS lookup for registry host failed (NOHOST)
  69  Registry unreachable or degraded (UNAVAILABLE)`);
}

export function helpManifests(): void {
  page(`${section('agentroot manifests')} - List registered manifests

${section('USAGE')}
  agentroot manifests [<query>] [options]

${section('DESCRIPTION')}
  Lists every manifest registered with the public registry. Server-side
  pagination via --page/--limit, or --all to walk every page (capped at
  1000). Use --query to narrow by domain substring.

${section('OPTIONS')}
  --query <q>       Free-text filter for domain
  --type <type>     Filter by published record type
  --page <N>        Page number (default 1)
  --limit <N>       Per-page limit (1..100, default 20)
  --all             Walk every page (capped at 1000)
  --json, -j        Output as JSON envelope
  --no-color        Disable ANSI color
  --quiet, -q       Suppress progress chatter

${section('EXAMPLES')}
  agentroot manifests --query doma
  agentroot manifests --type skill --limit 50
  agentroot manifests --all --json | jq '.manifests | length'

${section('EXIT CODES')}
  0   List retrieved (may be empty)
  69  Registry unreachable (UNAVAILABLE)`);
}

export function helpCollections(): void {
  page(`${section('agentroot collections')} - Browse curated collections

${section('USAGE')}
  agentroot collections [<slug>] [options]

${section('DESCRIPTION')}
  With no slug, lists every curated collection. With a slug, shows the
  items inside that collection (manifests + notes). Collections are the
  registry's way of grouping themed manifests (e.g. featured-domains,
  ai-agents).

${section('OPTIONS')}
  --json, -j        Output as JSON envelope
  --no-color        Disable ANSI color
  --quiet, -q       Suppress progress chatter

${section('EXAMPLES')}
  agentroot collections
  agentroot collections featured-domains
  agentroot collections featured-domains --json | jq '.items[]'

${section('EXIT CODES')}
  0   Retrieved
  69  Collection not found or registry unreachable (UNAVAILABLE)`);
}

export function helpSubmit(): void {
  page(`${section('agentroot submit')} - Submit a domain to the public registry

${section('USAGE')}
  agentroot submit <domain> [options]

${section('DESCRIPTION')}
  Submits a domain's manifest to the registry for verification + indexing.
  If --manifest-url is omitted, the CLI DNS-probes the domain first to
  surface the URL it found. The registry verifies DNS server-side; if the
  TXT record is missing, instructions for publishing it are printed.

${section('OPTIONS')}
  --manifest-url <url>   Explicit manifest URL (skips local DNS probe)
  --json, -j             Output as JSON envelope
  --no-color             Disable ANSI color
  --quiet, -q            Suppress progress chatter

${section('EXAMPLES')}
  agentroot submit mycompany.com
  agentroot submit mycompany.com --manifest-url https://mycompany.com/manifest.json
  agentroot submit mycompany.com --json | jq '.success'

${section('EXIT CODES')}
  0   Submitted and verified
  2   Missing domain argument (USAGE)
  68  DNS verification still pending (NOHOST)
  69  Registry unreachable (UNAVAILABLE)
  76  Manifest failed protocol validation (PROTOCOL)`);
}

export function helpVersion(): void {
  page(`${section('agentroot version')} - Print CLI + runtime info

${section('USAGE')}
  agentroot version [options]
  agentroot --version
  agentroot -v

${section('DESCRIPTION')}
  Prints the CLI version, Node version, OS/arch, configured registry API
  base, and the path of the on-disk config file. The full block is what
  to paste into a bug report. The --version / -v short form is one-line,
  matching \`node --version\` and \`npm --version\`.

${section('OPTIONS')}
  --json, -j        Output as a single JSON object
  --no-color        Disable ANSI color

${section('EXAMPLES')}
  agentroot version
  agentroot --version
  agentroot version --json | jq '.agentRoot'

${section('EXIT CODES')}
  0   Always`);
}
