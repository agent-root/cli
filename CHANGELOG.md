# Changelog

All notable changes to the `agent-root` CLI are documented in this file. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `agent-root stats` reads `/api/stats` for registry totals and per-TLD breakdown.
- `agent-root health` reads `/api/health` and exits non-zero when the registry is unhealthy.
- `agent-root manifests [--query] [--type] [--page] [--limit] [--all]` paginates `/api/manifests`.
- `agent-root collections [<slug>]` browses curated collections (`/api/collections`).
- `agent-root submit <domain> [--manifest-url]` posts to `/api/submit` with DNS pre-verification and TXT-record instructions on the failure path.
- `search` now accepts `--page`, `--limit`, and `--all` flags.
- `src/constants/protocol.ts` exposes `PROTOCOL_VERSION`, `DNS_PREFIX`, `DOCS_URL`, `txtHostFor()`, and `buildTxtRecord()` as the single source of truth for protocol literals.
- vitest test suite (55 tests across `tests/lib/`, `tests/commands/`, `tests/constants/`).
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

- Speculative `Roadmap` and `Acknowledgments` sections from README.
- `/api/discover` call from `search` (response shape didn't match the parser and the endpoint caps at 100 anyway; `/api/records` supersedes it).

## [0.2.0] 2026-04-21

Earlier history lives in the agentroot monorepo at https://github.com/d3-inc/agentroot/commits/main under `packages/cli/`.
