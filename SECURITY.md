# Security Policy

## Reporting a vulnerability

**Do not file a public GitHub issue for security bugs.**

Use one of these private channels:

1. **GitHub Private Vulnerability Reporting**: enabled on this repo (once it's public). Preferred path. Keeps the report attached to the repo and creates an audit trail.
2. **Email**: send to **mayank@d3.com** with a clear subject line and steps to reproduce.

We acknowledge reports within **3 business days** and aim to resolve confirmed issues within **90 days** of acknowledgment. The disclosure timeline is coordinated with the reporter; we publish an advisory and CVE (where applicable) at the same time as the fix.

## Supported versions

We publish security fixes for the latest minor release.

| Version       | Security fixes |
|---------------|----------------|
| latest minor  | yes            |
| older minors  | best-effort    |

## Scope

In scope:

- The `agent-root` CLI source in this repository.
- The `@agent-root/core` dependency consumed from npm. For `@agent-root/core` bugs, file at https://github.com/d3-inc/agentroot/security (the source repo for that package).

Out of scope:

- Denial-of-service against the public registry at `agentroot.io` (operational concern, not a CLI bug).
- Third-party domains that have published their own AgentRoot manifests (those are the domain owner's responsibility).
- Best-practice findings without a demonstrable security impact.

## Coordinated disclosure

Please do not publicly disclose the vulnerability until we have published an advisory or 90 days have elapsed since your initial report, whichever is sooner. We will credit you in the advisory unless you ask otherwise.
