# Maintaining

Operational reference for maintainers. Not contributor-facing; goes here so the steps can be replicated by any future maintainer.

For governance (roles, decisions, adding maintainers), see [GOVERNANCE.md](GOVERNANCE.md). For contributor workflow, see [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md). This file is about **what the repo admin does on GitHub** and **how to reproduce it via the CLI**.

## Repo settings (currently applied)

These were set via `gh repo edit` on this repo. Re-apply with the same command if state ever drifts.

```bash
gh repo edit agent-root/agent-root-cli \
  --enable-squash-merge \
  --enable-merge-commit=false \
  --enable-rebase-merge=false \
  --delete-branch-on-merge \
  --allow-update-branch \
  --enable-issues \
  --enable-wiki=false \
  --enable-discussions=false \
  --enable-projects=false
```

What this gets you:

| Setting | Value | Why |
|---|---|---|
| Merge: squash only | enabled | `CONTRIBUTING.md` documents squash as the default. Disabling merge-commit + rebase removes the dropdown and prevents accidental non-squash merges. |
| Delete head branch on merge | on | Keeps branch list clean. Forks aren't affected; only this repo's branches. |
| Allow update branch | on | Lets PR authors click "Update branch" to fast-forward without losing review state. |
| Issues | on | Required for the bug-report and feature-request templates. |
| Wiki | off | We host docs in-repo (`README.md`, `GOVERNANCE.md`, `MAINTAINERS.md`, `docs/`); a wiki creates a second source of truth. |
| Discussions | off (for now) | When you flip this on, update [.github/SUPPORT.md](.github/SUPPORT.md) and [MAINTAINERS.md](MAINTAINERS.md) to remove "(once enabled)" notes. Run `gh repo edit agent-root/agent-root-cli --enable-discussions`. |
| Projects | off | Not used at this size. |

Verify current state any time:

```bash
gh api /repos/agent-root/agent-root-cli \
  | jq '{private, allow_squash_merge, allow_merge_commit, allow_rebase_merge, delete_branch_on_merge, allow_update_branch, has_issues, has_projects, has_wiki, has_discussions}'
```

## Branch protection (BLOCKED until private repo upgrades or goes public)

GitHub's free plan does **not** offer branch protection on private repos. The first time you try to set protection on `main` while private, the API returns:

```
HTTP 403
"Upgrade to GitHub Pro or make this repository public to enable this feature."
```

Two ways to unlock:

1. **Make the repo public.** Branch protection is free on public repos. This is the path most OSS projects take.
2. **Upgrade the `agent-root` org to GitHub Team** (paid). Branch protection then works on private repos too.

When either condition is met, run the script below to apply the full protection set. The CONTRIBUTING.md "Branch protection" section already documents the policy publicly; this is just the apply step.

```bash
# Run after the repo is public OR the org is on Team plan.
cat > /tmp/agent-root-cli-bp.json <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Build / Type-check (Node 22)",
      "Build / Type-check (Node 24)"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON
gh api -X PUT /repos/agent-root/agent-root-cli/branches/main/protection \
  --input /tmp/agent-root-cli-bp.json
rm /tmp/agent-root-cli-bp.json
```

Verify with:

```bash
gh api /repos/agent-root/agent-root-cli/branches/main/protection | jq .
```

If the `Build / Type-check (Node 22)` context doesn't exist yet (CI hasn't run on `main` since the protection rule was set), GitHub will record the rule but not block until the first CI run completes. That is fine; the next push triggers CI and from then on the rule is enforced.

### What the protection enforces

This matches what [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md#branch-protection) tells contributors:

- Direct pushes to `main` are blocked. Every change lands through a PR.
- 1 approval required before merge.
- Stale reviews dismissed when new commits push.
- Code-owner review required where `.github/CODEOWNERS` applies.
- CI status checks `Build / Type-check (Node 22)` and `(Node 24)` must pass.
- Linear history required (squash or rebase only).
- Force-push to `main` forbidden.
- Branch deletion of `main` forbidden.
- Conversation resolution required before merge.
- `enforce_admins: false` lets admins bypass in true emergencies. Treat use of this as exceptional and document why.

## Adding collaborators

The repo is private. To grant maintainer access:

```bash
gh api -X PUT /repos/agent-root/agent-root-cli/collaborators/AlexSugak --field permission=push
gh api -X PUT /repos/agent-root/agent-root-cli/collaborators/isingh    --field permission=push
```

Permissions: `pull`, `triage`, `push`, `maintain`, `admin`. `push` is the right level for a maintainer; `admin` is reserved for the repo owner.

Once the org is on a paid plan, prefer adding maintainers to a GitHub team (`@agent-root/maintainers`) and granting the team push access. That makes CODEOWNERS rules cleaner (use `@agent-root/maintainers` instead of three individual handles).

## Workflows + CI

Two workflows ship in this repo: `.github/workflows/ci.yml` (build, type-check, vitest, smoke) and `.github/workflows/codeql.yml` (security scan).

- CodeQL is gated on `!github.event.repository.private`, so it auto-skips while the repo is private and turns on the moment it goes public. No action needed.
- `dependabot.yml` runs daily on npm + weekly on github-actions, grouped into a single minor-and-patch PR per ecosystem.

To list runs / re-run a failed one:

```bash
gh run list --repo agent-root/agent-root-cli --limit 5
gh run rerun <run-id> --repo agent-root/agent-root-cli --failed
```

## Releasing

There is no automated release pipeline yet (see [.github/CONTRIBUTING.md#releasing](.github/CONTRIBUTING.md#releasing)). The manual flow when ready:

```bash
# 1. Promote unreleased entries to a real version in CHANGELOG.md
# 2. Bump version in package.json
# 3. Open a release PR titled "chore(release): v0.X.Y", land it via review
# 4. From the merge commit on main:
git tag v0.X.Y -m "v0.X.Y"
git push origin v0.X.Y
# 5. Manual publish (no provenance / OIDC wiring yet):
pnpm publish --access public
# 6. Create a GitHub release pointing at the tag, with the CHANGELOG entry as the body:
gh release create v0.X.Y --notes-from-tag --repo agent-root/agent-root-cli
```

When the publish flow is automated, this section moves to a dedicated `RELEASING.md` and the manual block above gets removed.

## Recovering from a bad push

If something lands on `main` that shouldn't have:

1. **Revert via PR** (preferred): `git revert <bad-sha>` on a branch, open a PR, normal review, merge. History keeps the bad commit visible but neutralized.
2. **Force-revert** (rare; needs admin bypass on a protected `main`):
   ```bash
   git checkout main
   git reset --hard <last-good-sha>
   git push --force-with-lease origin main
   ```
   Only acceptable for secret leaks, license violations, or similar high-severity. Document why in a follow-up issue.

## History rewrite (one-time, done 2026-05-19)

This repo's commits 1-47 were originally authored under `chota-bheem-codes <mrwt005@gmail.com>` (a personal account that happened to be in the local git config at commit time). GitHub attributed them to `mynk-s-rwt`, the personal GitHub account that owns that email.

Rewritten to the correct identity `mayank-d3 <mayank.rawat@d3.com>` via:

```bash
git filter-branch -f \
  --env-filter '
    export GIT_AUTHOR_NAME="mayank-d3"
    export GIT_AUTHOR_EMAIL="mayank.rawat@d3.com"
    export GIT_COMMITTER_NAME="mayank-d3"
    export GIT_COMMITTER_EMAIL="mayank.rawat@d3.com"
  ' \
  --msg-filter '
    sed "s/chota-bheem-codes <mrwt005@gmail.com>/mayank-d3 <mayank.rawat@d3.com>/g"
  ' \
  --tag-name-filter cat \
  -- --all

git push --force-with-lease origin main
git push --force origin v0
```

The local git config in this repo's `.git/config` is now pinned to the right identity:

```ini
[user]
  name = mayank-d3
  email = mayank.rawat@d3.com
```

so future commits don't need rewriting. The `~/.gitconfig-d3` include is the canonical source for d3-repos identity; per-repo config in this checkout matches it.

## Quick reference

| Operation | Command |
|---|---|
| Verify repo settings | `gh api /repos/agent-root/agent-root-cli \| jq '{private, allow_squash_merge, delete_branch_on_merge, has_issues, has_discussions}'` |
| List branches with protection | `gh api /repos/agent-root/agent-root-cli/branches \| jq '.[] \| {name, protected}'` |
| Pull current branch protection JSON | `gh api /repos/agent-root/agent-root-cli/branches/main/protection \| jq .` |
| List collaborators | `gh api /repos/agent-root/agent-root-cli/collaborators \| jq '.[] \| {login, permissions}'` |
| List recent runs | `gh run list --repo agent-root/agent-root-cli --limit 10` |
| Failed-run logs | `gh run view <run-id> --repo agent-root/agent-root-cli --log-failed` |
| Make public when ready | `gh repo edit agent-root/agent-root-cli --visibility=public --accept-visibility-change-consequences` |
