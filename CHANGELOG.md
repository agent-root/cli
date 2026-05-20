# Changelog

All notable changes to the `agent-root` CLI are documented in this file. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.0] 2026-05-20

First standalone release. Cut from the independent
[agent-root/cli](https://github.com/agent-root/cli) repo. The monorepo
copy in `d3-inc/agentroot/packages/cli` is preserved for historical
reference but no longer the source of truth for new releases.

### Changed

- **Package renamed**: `agent-root` (unscoped, last published by the
  monorepo at `0.2.0`) to **`@agent-root/cli`** (scoped, under the
  agent-root npm org). Installed binary is still `agent-root` (and the
  `agentroot` alias), so existing scripts that invoke the command don't
  break — only the install command changes.
  - Old: `npm install -g agent-root` and `npx agent-root <cmd>`
  - New: `npm install -g @agent-root/cli` and `npx -p @agent-root/cli agent-root <cmd>`
  - The legacy `agent-root@0.2.0` remains on npm; new releases publish
    under `@agent-root/cli` only.

### Added

#### CLI hardening (Batch 4 — polish + discoverability)

- `agent-root completion <bash|zsh|fish|pwsh>` prints a shell completion script to stdout. Completes commands, top-level flags, and value enums for `--tool` and `--type`. Install snippets are in the README's "Shell completion" section.
- Levenshtein-based "Did you mean?" suggestions on unknown commands: `agent-root reslove` now prints `Did you mean: agentroot resolve?` and exits with `USAGE` (2). Lives in `src/cli/suggest.ts`.
- Help screenshot regenerated to reflect the new TOOLING section and 4-batch flag surface.

#### CLI hardening (Batch 3 — exit codes + error shape)

- Sysexits-style exit codes in `src/cli/exit-codes.ts` (`OK`, `GENERIC`, `USAGE`, `NOINPUT`, `NOHOST`, `UNAVAILABLE`, `PROTOCOL`, `NOPERM`, `CONFIG`). Documented in README under "Exit codes".
- `fatal(msg, hint?, code?)` now accepts a numeric exit code and maps every call site to the right sysexits constant. Default stays `GENERIC` (1).
- JSON error envelope: in `--json` mode errors emit `{ error: { code, message, hint? } }` to stdout (single envelope, contract-style), so scripts can branch on `jq '.error.code'` and `$?` together.
- Per-command help: `agent-root <cmd> --help` drills into a focused page for all 16 commands (15 from Batch 3 + `completion`). Each page lists USAGE, DESCRIPTION, OPTIONS, EXAMPLES, and a per-command EXIT CODES table.

#### CLI hardening (Batch 2 — streams + env + accessibility)

- `NO_COLOR=1` and `--no-color` disable ANSI escapes; TTY detection auto-disables color in non-TTY contexts. Wired through `src/cli/colors.ts`.
- `--quiet` / `-q` suppresses spinners and non-essential notes; success messages still go to stderr when present.
- Spinners, progress messages, and `pc.dim('# …')` annotations now write to **stderr**. Data and `--json` output go to **stdout**. `agent-root <cmd> --json | jq` works without `2>/dev/null`.
- `CI=true` auto-implies `--yes` and `--no-color` (no prompts, plain text). `AGENTROOT_YES=1`, `AGENTROOT_JSON=1`, `AGENTROOT_NO_COLOR=1` namespaced env vars supported.

#### CLI hardening (Batch 1 — POSIX argv + short aliases + version)

- Short aliases for the top flags: `-h/--help`, `-v/--version`, `-j/--json`, `-y/--yes`, `-f/--force`, `-q/--quiet`.
- `--key=value` form accepted in addition to `--key value`.
- `--` end-of-options separator: any subsequent token is positional even if it starts with `--`.
- Negation via `--no-<flag>` for any boolean (`--no-install`, `--no-color`).
- Multi-word flags accept both kebab-case and camelCase (`--manifest-url` ≡ `--manifestUrl`).
- `--version` / `-v` (one-liner) plus a richer `agent-root version` subcommand that prints version, Node, OS, API base, and config path — paste into bug reports.

#### Pre-hardening (earlier in this milestone)

- `agent-root health` reads `/api/health` and exits non-zero when the registry is unhealthy.
- `agent-root manifests [--query] [--type] [--page] [--limit] [--all]` paginates `/api/manifests`.
- `agent-root collections [<slug>]` browses curated collections (`/api/collections`).
- `agent-root submit <domain> [--manifest-url]` posts to `/api/submit` with DNS pre-verification and TXT-record instructions on the failure path.
- `search` now accepts `--page`, `--limit`, and `--all` flags.
- `src/constants/protocol.ts` exposes `PROTOCOL_VERSION`, `DNS_PREFIX`, `DOCS_URL`, `txtHostFor()`, and `buildTxtRecord()` as the single source of truth for protocol literals.
- vitest test suite (159 tests across `tests/cli/`, `tests/lib/`, `tests/commands/`, `tests/constants/`).
- Playwright-based screenshot tooling (`scripts/capture-screenshots.mjs`) with 12 generated PNGs under `docs/screenshots/`.
- Project `CLAUDE.md` documenting structural conventions and the README/screenshot-sync rule for future contributors and AI assistants.

### Changed

- `search` backend swapped from the broken `/api/discover` parsing path to `/api/records`, the same paginated multi-type endpoint the web UI consumes. JSON output now returns the full `{results, total, page, pages, limit}` envelope.
- README rewritten with a richer tutorial, verified `doma.xyz` examples, embedded screenshots, and removed speculative roadmap/acknowledgments sections.
- All user-visible em dashes replaced with colons, commas, or periods across docs and source.
- `src/` reorganised into `cli/`, `commands/`, `constants/`, `services/{config,dns,http,install}/`, `types/`, and `utils/`. Largest file is now under 250 LOC.
- `installSkill` (411-line monolith) split into `detectTargetTools`, `gatherSkillsToInstall`, and `installOneSkill` phase helpers.
- Long-signature functions (5 to 8 positional params) converted to options-object form.
- Performance fixes from `PERF-AUDIT.md`: fetch timeouts, parallel supporting-file fetches, deduplicated DNS calls in resolve.
- `typescript` bumped to 5.9.3, `@types/node` to 25.9.0, GitHub Actions (`checkout`, `setup-node`, `pnpm/action-setup`) to v6, `codeql-action` to v4, matching the agentroot monorepo's dependabot policy.

### Removed

- `agent-root stats` command. Registry totals are a monitoring concern, not a CLI one; the `/api/stats` endpoint remains for dashboards.
- Speculative `Roadmap` and `Acknowledgments` sections from README.
- `/api/discover` call from `search` (response shape didn't match the parser and the endpoint caps at 100 anyway; `/api/records` supersedes it).

## [0.2.0] 2026-04-21

Earlier history lives in the agentroot monorepo at https://github.com/d3-inc/agentroot/commits/main under `packages/cli/`.
