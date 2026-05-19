# Governance

This document describes how the `agent-root` CLI project is run: who has decision-making authority, how new maintainers are added, how disputes are resolved, and what happens when a maintainer steps back.

The roster of current maintainers lives in [MAINTAINERS.md](MAINTAINERS.md). This document describes the rules; that file holds the names.

## Roles

The project has two roles. Tiers are intentionally minimal at this size.

### Maintainer

A maintainer can:

- Approve and merge pull requests (subject to branch protection rules).
- Triage issues, apply labels, close stale or out-of-scope reports.
- Cut releases when the release process is in place.
- Respond to security reports (per [SECURITY.md](SECURITY.md)).
- Vote in lazy-consensus decisions (see Decision-making below).

Every maintainer is listed in [MAINTAINERS.md](MAINTAINERS.md) and in [.github/CODEOWNERS](.github/CODEOWNERS).

### Project lead

One maintainer is designated the project lead (currently noted in [MAINTAINERS.md](MAINTAINERS.md)). The lead's only additional authority is:

- **Tie-breaking** on technical disagreement when lazy consensus does not resolve within a reasonable time (see Decision-making below).
- **Final escalation** for Code of Conduct cases when the reporter or the subject is themselves a maintainer.

The lead does not have unilateral veto power on routine PRs and is bound by the same review rules as other maintainers.

## Decision-making

Most decisions are made by **lazy consensus**: a maintainer proposes a change (in an issue, PR, or discussion), and if no other maintainer objects within a reasonable window, the proposal is accepted.

Practical guidance:

- **Routine PRs** (a single command improvement, a bug fix, a doc tweak): one maintainer's approval plus passing CI is enough to merge. Branch protection enforces the minimum.
- **Significant changes** (new top-level command, new dependency, change to the protocol-facing CLI contract, change to release/security process): open an issue or discussion first, give the other maintainers at least 72 hours to object, then proceed if no objection lands. Note this kind of change in the PR description.
- **Conflict / tie**: if maintainers disagree and discussion does not converge within a week, the project lead makes the final call and documents the reasoning in the PR or issue.

There is no formal vote. We are too small for one to be useful.

## Adding a new maintainer

Eligibility is by demonstrated contribution:

- ~5 merged PRs across the project over a few months,
- consistent high-quality reviews when asked,
- engagement in triage and discussions.

Process:

1. An existing maintainer **nominates** the contributor in a private channel or a dedicated GitHub issue.
2. The nomination is open for at least **7 days** for other maintainers to comment.
3. If no objections are raised (lazy consensus), the candidate is invited.
4. On acceptance, the new maintainer is added to [MAINTAINERS.md](MAINTAINERS.md), [.github/CODEOWNERS](.github/CODEOWNERS), and any GitHub teams or repo permissions.

There is no probationary period. Once added, a new maintainer has the same authority as any other.

## Stepping back, emeritus, and removal

People's circumstances change. We acknowledge that explicitly.

### Voluntary step-back

A maintainer who wants to step back can open a PR moving their entry from `Current maintainers` to `Emeritus maintainers` in [MAINTAINERS.md](MAINTAINERS.md), and from `.github/CODEOWNERS`. The step-back is effective when the PR merges.

### Inactivity

If a maintainer has been silent on the project (no PRs, reviews, or substantive comments) for **12 months**:

1. Another maintainer reaches out privately to check in.
2. If the absent maintainer wants to remain active, no action is taken.
3. If they want to step back, the voluntary process above applies.
4. If they do not respond within 30 days of the check-in, the remaining maintainers may move them to emeritus by lazy consensus.

### Removal for cause

In the rare case of a serious violation of the Code of Conduct, a maintainer may be removed by lazy consensus of the remaining maintainers, with the case documented privately. The project lead does not have unilateral removal authority; the rest of the maintainers do, collectively.

## Conflict of interest

Maintainers should disclose conflicts of interest when reviewing PRs (employer relationship, dependency on the project, financial stake). Disclosure is enough; recusal is not required unless the maintainer wishes.

## Code of Conduct enforcement

CoC reports go to the contact in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), not to the issue tracker. The enforcement ladder (Correction → Warning → Temporary Ban → Permanent Ban) is documented there. The maintainer who receives the report leads the response unless they are personally involved, in which case the project lead takes over; if the project lead is involved, the remaining maintainers take over.

## Security incidents

Security incident response is documented in [SECURITY.md](SECURITY.md). Any maintainer can acknowledge a private report; the responding maintainer coordinates the fix and disclosure with the rest of the team.

## Release authority

While there is no automated release pipeline today (see [CONTRIBUTING.md#releasing](CONTRIBUTING.md#releasing)), once we publish, **any maintainer can cut a release** of the form patch / minor. Major-version releases (1.0, 2.0, …) require lazy consensus of all maintainers in the same way significant changes do.

## Changing this document

Changes to `GOVERNANCE.md` are themselves significant changes (see Decision-making above). Open a PR, give other maintainers 72 hours to object, and the PR title should start with `governance:` so it stands out in the PR list.
