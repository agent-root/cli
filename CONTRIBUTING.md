# Contributing to agent-root CLI

Thanks for your interest in contributing! This document covers how to set up the project, the contribution flow, and the conventions we follow.

## Code of Conduct

By participating, you agree to abide by the [Contributor Covenant](CODE_OF_CONDUCT.md). Report unacceptable behavior to **mayank@d3.com**.

## Where to start

- **Bug reports / feature requests**: open an [issue](https://github.com/d3-inc/agentroot/issues/new/choose). Search existing issues first.
- **Documentation**: PRs to README welcome anytime; no prior issue required.
- **Looking for something to work on**: filter open issues by the `good first issue` or `help wanted` labels.
- **Protocol-level changes** (new record types, manifest schema): those go to the main [agentroot repo](https://github.com/d3-inc/agentroot), not this one. The CLI consumes the protocol; it doesn't define it.

## File an issue before a non-trivial PR

For anything beyond a small fix or documentation tweak, **open an issue or discussion first** so maintainers can confirm scope before you write code. This protects your time. A PR that gets closed because the change isn't wanted is a worse outcome for both sides than a short conversation up front.

Trivial PRs (typo fixes, small doc clarifications, single-line bug fixes with obvious correctness) do not need a prior issue.

Non-trivial PRs that bypass this step may be asked to be split, narrowed, or rewritten before review begins.

## Development setup

We use the standard **fork and pull-request** workflow that GitHub-hosted OSS projects follow. Nobody pushes directly to this repository's `main` branch; every change lands through a reviewed PR from a fork.

Prerequisites:

- Node.js 18 or later (22 LTS recommended; CI tests against 22 and 24)
- pnpm (any recent version)
- A GitHub account

### 1. Fork the repo

Click **Fork** on the repository page on GitHub. This creates `https://github.com/<your-username>/agentroot` (or `/agent-root-cli` once the standalone is live), a copy you control.

### 2. Clone your fork and add the upstream remote

```bash
# Replace <your-username> with your GitHub handle
git clone https://github.com/<your-username>/agentroot.git
cd agentroot   # or: cd agent-root-cli, once the standalone repo is live

# Track the canonical repo as 'upstream' so you can pull in changes
git remote add upstream https://github.com/d3-inc/agentroot.git
git remote -v   # confirm: origin = your fork, upstream = canonical
```

### 3. Install + build

```bash
pnpm install
pnpm build
```

The CLI depends on `@agent-root/core` from npm. No workspace / monorepo setup needed.

### 4. Keep your fork up to date

Before starting new work, sync your fork with upstream:

```bash
git fetch upstream
git checkout main
git merge --ff-only upstream/main
git push origin main
```

If `--ff-only` fails because your local `main` has commits, that is a sign you committed straight to `main` instead of a feature branch. Move those commits to a feature branch (`git branch feature/x && git reset --hard upstream/main`) and re-push.

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

## Branching and pull requests

All work happens on a feature branch inside your fork. PRs open against the canonical repo's `main` branch.

### Make a branch

```bash
git checkout main
git pull --ff-only upstream main
git checkout -b feature/short-description   # or fix/..., or docs/...
```

Branch naming convention:

- `feature/<short-description>` for new commands, flags, or behaviors
- `fix/<short-description>` for bug fixes
- `docs/<short-description>` for documentation-only changes
- `chore/<short-description>` for tooling, deps, or build tweaks

### Push and open the PR

```bash
git push -u origin feature/short-description
```

GitHub will print a URL to open a pull request. The base repo is `d3-inc/agentroot` (or the canonical standalone repo once it is live), base branch `main`. Head is your fork's feature branch.

### Review requirements

- **At least 1 maintainer approval** is required before merge.
- **CI must be green** (type-check, build, tests). Failing CI blocks merge.
- **Code-owner review** is required for changes in any `CODEOWNERS`-listed path.
- **Linear history** is enforced. Rebase your branch onto the latest `main` rather than merging `main` into your branch:

  ```bash
  git fetch upstream
  git rebase upstream/main
  git push --force-with-lease
  ```

- **Squash merging is the default** for small PRs; multi-commit PRs that tell a story (e.g. "extract helper" + "use helper" + "remove old call sites") may be merged with their history preserved at the maintainer's discretion.

### After merge

- Delete your feature branch (GitHub offers a button after merge; or `git push origin --delete feature/...`).
- Sync your fork's `main` from `upstream/main` (the four commands under "Keep your fork up to date" above).

## Branch protection

The canonical repo's `main` branch is configured (by repo administrators) so that:

- **Direct pushes to `main` are blocked.** Every change lands through a PR.
- **At least 1 review approval is required** before a PR can merge.
- **CI status checks must pass** before merge (the `Build / Type-check (Node 22)` and `Build / Type-check (Node 24)` jobs from `.github/workflows/ci.yml`, plus `Unit tests` and `Smoke test` within each).
- **Code-owner review is required** when files matching `.github/CODEOWNERS` change.
- **Stale reviews are dismissed** when new commits are pushed to a PR.
- **Force pushes to `main` are forbidden.**

Maintainers verify these settings under **Settings → Branches → Branch protection rules** on the GitHub repo page. New maintainers do not need write access to `main` directly; the same fork-and-PR flow applies. A maintainer's elevated privilege is approving PRs and merging, not bypassing the rules.

### Why this matters for publishing

There is no automated publish pipeline today (see [Releasing](#releasing)), and the package has not been published to npm under this repo's control. But once we do publish:

- The `agent-root` npm package will be public, so anyone can install it.
- Nobody outside the maintainer team can push directly to this repo because of branch protection, so nobody outside the team can land code that ends up in a published tarball.
- The publish step itself (when it is added) will run from a tagged commit on `main`, which by definition has been through review.

This is the standard OSS pattern: open package, restricted-write repo, gated by PR review.

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

## AI-assisted contributions

We are pragmatic about AI tools. You are welcome to use them, and we have two rules.

**No AI co-authorship.** Please do not add `Co-Authored-By:` trailers crediting Claude, Copilot, Cursor, ChatGPT, or any other AI assistant. The same applies to "Generated with..." footers in commit messages or PR descriptions. If you used AI tooling to draft a change, that is your choice as the author; the tool is not a co-author. The `Signed-off-by:` line from `git commit -s` should be the only trailer on the commit.

**Soft disclosure expectation.** If a meaningful portion of the change was AI-assisted (drafted with an LLM, refactored by an agent, etc.), please mention it briefly in the PR description, e.g. _"Drafted with help from Claude; I reviewed every line before submitting."_ This is not a gate, just context for reviewers. We do not reject PRs for being AI-assisted; we may ask follow-up questions if the diff suggests the contributor did not read the code.

**You are still the author.** By signing off with DCO, you are certifying that the code is yours to submit under the project's license. That responsibility does not transfer to a model.

## Triage

When you open an issue or PR, expect this:

- The `triage` label is applied automatically by the issue template.
- A maintainer will leave at least an acknowledgement comment within **~7 days** in most cases. We do not promise a fix in that window, only that you will not hear silence.
- The maintainer replaces `triage` with one of these labels as the request settles:

  | Label              | Meaning                                                              |
  |--------------------|----------------------------------------------------------------------|
  | `bug`              | Confirmed bug. Reproducible, affects current behavior.               |
  | `enhancement`      | Confirmed feature request worth doing.                               |
  | `good first issue` | Scoped, well-defined, friendly for new contributors.                 |
  | `help wanted`      | Scoped, but the team does not have bandwidth; outside PRs welcome.   |
  | `needs-repro`      | We cannot reproduce yet; please add steps or sample output.          |
  | `needs-info`       | Awaiting clarification from the reporter.                            |
  | `discussion`       | Out of scope for an immediate change; conversation needed.           |
  | `wontfix`          | Intentional behavior or out of scope; closed with explanation.       |
  | `duplicate`        | Already tracked in another issue (linked in comments).               |

If your issue still has the `triage` label after a week, feel free to comment and ping a maintainer. We are not infallible.

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

There is **no automated release pipeline** at the moment. The repo intentionally ships no publish workflow until the release strategy (registry, signing, provenance, cadence) is decided. Maintainers cut releases manually when the package is ready to ship.

The interim manual flow when we do publish:

1. Land all intended PRs in `main` via the normal review process.
2. Promote `## [Unreleased]` in `CHANGELOG.md` to a new version + date.
3. Bump `version` in `package.json`. Pick semver per the Changed/Removed entries.
4. Open a release PR (`chore(release): v0.X.Y`) so the version bump itself goes through review.
5. After merge, tag the release commit locally (`git tag v0.X.Y -m "v0.X.Y"`) and push the tag.
6. From the tagged commit, run `pnpm publish --access public` (provenance and 2FA are added once we decide on the publish identity).

Release authority is documented in [GOVERNANCE.md#release-authority](GOVERNANCE.md#release-authority): any maintainer can cut a patch / minor release; major releases require lazy consensus.

When the publish pipeline is automated, this section moves to a dedicated `RELEASING.md`.

## Getting help

Stuck? Open a discussion or comment on your PR. Happy to walk through anything. The maintainer roster is in [MAINTAINERS.md](MAINTAINERS.md).

Thanks again for contributing.
