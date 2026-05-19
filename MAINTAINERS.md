# Maintainers

This file lists the people responsible for stewarding the `agent-root` CLI. For how maintainers are added, removed, and how decisions are made, see [GOVERNANCE.md](GOVERNANCE.md).

## Current maintainers

| Name             | GitHub handle | Areas of ownership            | Active since |
|------------------|---------------|-------------------------------|--------------|
| Mayank Rawat     | @mayank-d3    | CLI + releases                | 2026-04      |
| Alexandr Sugak   | @AlexSugak    | CLI + code review             | 2026-04      |
| Inderpreet Singh | @isingh       | Project lead + tie-breaker    | 2026-04      |

The **project lead** (per [GOVERNANCE.md](GOVERNANCE.md#project-lead)) breaks ties on technical disagreement when lazy consensus does not converge and serves as the final escalation point for Code of Conduct cases involving other maintainers.

## Emeritus maintainers

People who have stepped back from active maintenance. Listed in chronological order of step-back.

_None yet._

## Responsibilities

Every maintainer is expected to:

- **Triage** new issues and PRs within ~7 days of opening (at minimum, a label and an acknowledgement comment).
- **Review** pull requests assigned by `.github/CODEOWNERS` or by ping in good faith and on a reasonable cadence.
- **Cut releases** when the release process is in place (any maintainer can cut a patch / minor release; major releases require lazy consensus per [GOVERNANCE.md](GOVERNANCE.md#release-authority)).
- **Respond to security reports** routed via [SECURITY.md](SECURITY.md). Any maintainer can acknowledge; the responding maintainer coordinates the fix.
- **Uphold the Code of Conduct** ([CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)) and handle reports according to its enforcement ladder.

Maintainers are not on-call. The expectations above are guidelines, not SLAs.

## Becoming a maintainer

The full process is in [GOVERNANCE.md#adding-a-new-maintainer](GOVERNANCE.md#adding-a-new-maintainer). In short: ~5 merged PRs over a few months + consistent review quality + nomination by an existing maintainer + 7-day lazy-consensus window.

## Stepping back

Voluntary step-back is a one-line PR moving your entry to **Emeritus maintainers** above. Inactivity-triggered step-back (12 months silent + 30-day check-in window) is described in [GOVERNANCE.md#stepping-back-emeritus-and-removal](GOVERNANCE.md#stepping-back-emeritus-and-removal).

## Reaching maintainers

- For project questions, open a [Discussion](https://github.com/d3-inc/agentroot/discussions) (once enabled).
- For Code of Conduct concerns, email **mayank@d3.com**.
- For security issues, see [SECURITY.md](SECURITY.md). Do not file a public issue.
