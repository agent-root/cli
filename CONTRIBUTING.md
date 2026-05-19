# Contributing to agent-root CLI

Thanks for your interest in contributing! This document covers how to set up the project, the contribution flow, and the conventions we follow.

## Code of Conduct

By participating, you agree to abide by the [Contributor Covenant](CODE_OF_CONDUCT.md). Report unacceptable behavior to **mayank@d3.com**.

## Where to start

- **Bug reports / feature requests**: open an [issue](https://github.com/d3-inc/agentroot/issues/new/choose).
- **Documentation**: PRs to README welcome anytime.
- **CLI features**: new commands, new flags, new tool integrations — file an issue first to align on scope, then PR.
- **Protocol-level changes** (new record types, manifest schema): those go to the main [agentroot repo](https://github.com/d3-inc/agentroot), not this one. The CLI consumes the protocol; it doesn't define it.

## Development setup

Prerequisites:

- Node.js 18 or later (22 LTS recommended; we test against 22 and 24)
- pnpm (any recent version)

```bash
git clone https://github.com/d3-inc/agentroot.git
cd agentroot  # — actually, once this repo is live: cd agent-root-cli
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

## Branching and PRs

- Fork the repo, branch off `main`.
- Branch naming: `feature/short-description`, `fix/short-description`, or `docs/short-description`.
- Open the PR against `main`. PRs require **1 review** before merging.
- CI must be green (type-check, build).
- Linear history is enforced — rebase instead of merging `main` into your branch.

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

- **Max 300 lines per file** — split if larger.
- **Functions <= 50 lines** — extract phase helpers.
- **No `any` types** — use proper interfaces or `unknown` + type guards.
- **Validate at boundaries** — flag parsing, registry responses.
- **Conservative output** — never print colors when `--json` is passed.

## Tests

We don't require tests for every PR (the CLI is mostly thin wrappers around `@agent-root/core` and the registry API). We do require manual verification in the PR description for behavioral changes.

## Releasing

Maintainer-only:

1. Land all PRs in the release.
2. Update `## [Unreleased]` in `CHANGELOG.md` to the new version + date.
3. Bump `package.json` version.
4. Tag the release: `git tag v0.3.0 -s -m "v0.3.0"` then `git push --tags`.
5. The `release.yml` workflow publishes to npm with provenance.

## Getting help

Stuck? Open a discussion or comment on your PR — happy to walk through anything. The maintainer roster is in [MAINTAINERS.md](MAINTAINERS.md).

Thanks again for contributing.
