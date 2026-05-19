# agent-root

[![npm](https://img.shields.io/npm/v/agent-root.svg)](https://www.npmjs.com/package/agent-root)
[![license](https://img.shields.io/npm/l/agent-root.svg)](LICENSE)
[![Node](https://img.shields.io/node/v/agent-root.svg)](https://nodejs.org/)

The CLI for the **AgentRoot protocol** — DNS-based discovery for AI capabilities.

`agent-root` resolves domains via DNS, fetches their AgentRoot manifests, and helps you install the agents, MCP servers, skills, and A2A endpoints they declare.

> **What's AgentRoot?** A domain owner publishes a `_agentroot.<domain>` TXT record pointing at a JSON manifest. Anyone can resolve that domain to discover the AI capabilities it exposes. No gatekeepers, no API keys, no central registry required. See [agentroot.io](https://agentroot.io).

## Install

```bash
# Run without installing
npx agent-root <command>

# Or install globally
npm install -g agent-root
```

Requires Node.js 18 or later.

## Quick start

### Resolve a domain

```bash
npx agent-root resolve stripe.com
npx agent-root resolve stripe.com/payments
npx agent-root resolve stripe.com --json
```

### Search the public registry

```bash
npx agent-root search "database" --type mcp
npx agent-root search "research" --type agent
```

### Install a skill or MCP server

```bash
npx agent-root install example.com/coding-helpers --tool claude
npx agent-root install example.com --all
```

Supported `--tool` values: `claude`, `cursor`, `codex`, `gemini`, `agents` (cross-tool shared dir).

### Publish your own manifest

```bash
npx agent-root init --domain mycompany.com
npx agent-root validate .well-known/agentroot.json
```

Then add the DNS TXT record:

```text
_agentroot.mycompany.com  TXT  "v=ar1 manifest=https://mycompany.com/.well-known/agentroot.json"
```

## Commands

| Command | Purpose |
|---|---|
| `resolve <domain>[/recordId]` | Look up via DNS, list capabilities |
| `search <query>` | Search the registry by name / capability / type |
| `install <domain>/<recordId>` | Install a skill or MCP server |
| `uninstall <domain>/<recordId>` | Remove an installed item |
| `update <domain>/<recordId>` | Re-fetch and reinstall |
| `list` | Show what's installed on this machine |
| `init` | Scaffold a manifest in the current dir |
| `validate <file>` | Lint a manifest file |
| `config` | Inspect / change CLI config |

Run `npx agent-root <command> --help` for full flags. Run `npx agent-root help` for the full command list.

## How it works

The CLI is **DNS-first** — it speaks the protocol directly. The public registry at `agentroot.io` is a convenience for search and discovery, not a dependency.

```text
1. dig TXT _agentroot.<domain>        → manifest URL
2. fetch <manifest URL>               → list of records
3. parse + install per record type    → SKILL.md files / MCP config / etc.
```

For full protocol details, visit [agentroot.io/docs/protocol](https://agentroot.io/docs/protocol).

## Configuration

Configuration is stored at `~/.config/agent-root/config.json`. Inspect or change it with:

```bash
agent-root config get
agent-root config set api-url https://agentroot.io
```

You can also override via env var: `AGENTROOT_API_BASE=https://my-mirror.example.com`.

The CLI does **not** require an API key. The endpoints it calls (`/api/discover`, `/api/manifests/*`, `/api/find-skills`, `/api/stats`) are public-read.

## Contributing

PRs, issues, and feature requests welcome — start with [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

To report a security vulnerability, see [SECURITY.md](SECURITY.md). Do **not** file a public issue for security bugs.

## License

MIT — see [LICENSE](LICENSE).

## Roadmap

- **Rate limiting**: the public API is currently unauthenticated and unmetered. If usage warrants it, per-IP rate limits will land on the API side; the CLI may add an optional `AGENTROOT_API_KEY` env var for authenticated higher-limit tiers. Not blocking day-one.
- **More tools**: native support for tool-specific install paths beyond claude/cursor/codex/gemini/agents.
- **Conformance suite**: a `agent-root validate --strict` mode that runs the full protocol conformance test suite (committed for 90 days post-launch).

## Acknowledgments

AgentRoot was originally developed at [D3 Inc](https://d3.com). This CLI was extracted from the [agentroot monorepo](https://github.com/d3-inc/agentroot) for standalone OSS distribution. The shared library `@agent-root/core` (also MIT) lives on npm and is what this CLI depends on.
