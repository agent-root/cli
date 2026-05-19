# Contributing to agent-root CLI

Thanks for your interest in contributing! This document covers how to set up the project, the contribution flow, and the conventions we follow.

## Code of Conduct

By participating, you agree to abide by the [Contributor Covenant](CODE_OF_CONDUCT.md). Report unacceptable behavior to **mayank@d3.com**.

## Where to start

- **Bug reports / feature requests**: open an [issue](https://github.com/d3-inc/agentroot/issues/new/choose).
- **Documentation**: PRs to README welcome anytime.
- **CLI features**: new commands, new flags, new tool integrations. File an issue first to align on scope, then PR.
- **Protocol-level changes** (new record types, manifest schema): those go to the main [agentroot repo](https://github.com/d3-inc/agentroot), not this one. The CLI consumes the protocol; it doesn't define it.

## Development setup

Prerequisites:

- Node.js 18 or later (22 LTS recommended; we test against 22 and 24)
- pnpm (any recent version)

```bash
git clone https://github.com/d3-inc/agentroot.git
cd agentroot  # once the standalone repo is live: cd agent-root-cli
pnpm install
pnpm build
```

The CLI depends on `@agent-root/core` from npm. No workspace / monorepo setup needed.

## Running locally

```bash
pnpm build
node dist/bin/agentroot.js help
node dist/bin/agentroot.js resolve agentroot.io
```

For active development, run `tsc --watch` in one terminal and exercise the CLI from another.

## Running tests

```bash
pnpm test              # one-shot run
pnpm test:watch        # re-run on save
pnpm test:coverage     # produce coverage report (html in ./coverage/)
```

Tests live under `tests/` and mirror the `src/` tree. We use [vitest](https://vitest.dev). No separate build step is required, TypeScript runs directly.

## Regenerating documentation screenshots

The PNGs under `docs/screenshots/` are captured automatically from real CLI sessions. If you change a command's output and the screenshot in the README no longer matches:

```bash
pnpm run screenshots
```

This runs `scripts/capture-screenshots.mjs`. The script executes each command, converts the ANSI output to an HTML page styled like a macOS terminal, and uses Playwright headless Chromium to take the PNG. It self-contains its test fixtures and uses temp directories for install/uninstall.

You'll need Playwright's Chromium binary the first time (`pnpm exec playwright install chromium`). The recipe is in the script. Add or modify recipes there.

## Branching and PRs

- Fork the repo, branch off `main`.
- Branch naming: `feature/short-description`, `fix/short-description`, or `docs/short-description`.
- Open the PR against `main`. PRs require **1 review** before merging.
- CI must be green (type-check, build, **tests**).
- Linear history is enforced. Rebase instead of merging `main` into your branch.

## Commit conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add --json output to search command
fix: handle missing manifest_url gracefully
chore(deps): bump @agent-root/core to 0.3.0
docs: clarify install-tool semantics
refactor: split installSkill into phase helpers
```

Common types: `feat`, `fix`, `chore`, `docs`, `refactor`, `perf`, `build`, `ci`.

## DCO sign-off

We use the [Developer Certificate of Origin](https://developercertificate.org/). Sign every commit with `-s`:

```bash
git commit -s -m "feat: your message"
```

This appends a `Signed-off-by: Your Name <your.email@example.com>` line.

## PR checklist

Before requesting review:

- [ ] CI is green (type-check, build)
- [ ] Commits are signed (`Signed-off-by` lines present)
- [ ] Conventional Commits format used
- [ ] Updated `README.md` if user-facing behavior changed
- [ ] Updated `CHANGELOG.md` under `## [Unreleased]`
- [ ] Breaking changes are flagged in the PR description

## License-compatibility policy

This project is MIT outbound. New dependencies must use MIT-compatible permissive licenses (MIT, BSD, Apache, ISC, MPL-2.0, 0BSD, Unlicense, CC0-1.0). PRs introducing GPL / AGPL / SSPL / BUSL will be asked to refactor.

## Architecture rules

When touching the codebase, please respect:

- **Max 300 lines per file**. Split if larger.
- **Functions <= 50 lines**. Extract phase helpers.
- **No `any` types**. Use proper interfaces or `unknown` + type guards.
- **Validate at boundaries** (flag parsing, registry responses).
- **Conservative output**. Never print colors when `--json` is passed.

## Tests are required for new behavior

Every PR that adds or changes runtime behavior **must include at least one test** that fails without the change and passes with it. This applies to:

- New commands or flags
- New helper functions
- Bug fixes (add a regression test)
- Behavior changes in existing functions

The test should live under `tests/` mirroring the source path (e.g., `src/lib/format.ts` → `tests/lib/format.test.ts`). Prefer pure-function tests; for I/O code, use `vi.mock()` to isolate the unit under test.

**Exempt from the test requirement:**

- Documentation-only changes (`docs:` prefix)
- Dependency bumps (`chore(deps):` prefix)
- Build / CI / tooling changes that don't touch runtime code
- Pure refactors that preserve behavior, but you must include the existing test run output in the PR description as evidence

The test step runs in CI on every PR. PRs with failing tests cannot be merged.

### Patterns to follow

Look at `tests/lib/format.test.ts` and `tests/commands/install-helpers.test.ts` for the shape we want:

- One `describe` block per public function
- Test names read like sentences: `it('honors --tool flag and short-circuits detection')`
- Strip ANSI codes when asserting on colored output
- Reset mocks in `beforeEach`

## Releasing

Maintainer-only:

1. Land all PRs in the release.
2. Update `## [Unreleased]` in `CHANGELOG.md` to the new version + date.
3. Bump `package.json` version.
4. Tag the release: `git tag v0.3.0 -s -m "v0.3.0"` then `git push --tags`.
5. The `release.yml` workflow publishes to npm with provenance.

## Getting help

Stuck? Open a discussion or comment on your PR. Happy to walk through anything. The maintainer roster is in [MAINTAINERS.md](MAINTAINERS.md).

Thanks again for contributing.
