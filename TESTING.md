# Testing the agent-root CLI

Copy-paste smoke test recipe to verify the standalone CLI works. Run each
section in order. Every expected output below has been verified against the
live agentroot.io registry.

## 1. Prerequisites

- Node.js >= 18
- pnpm (`npm install -g pnpm`)

## 2. Setup

```bash
cd path/to/agent-root-cli
pnpm install
pnpm build
```

Expected: zero TypeScript errors. `dist/bin/agentroot.js` exists.

```bash
ls dist/bin/agentroot.js
```

## 3. Local install for testing

Link the CLI globally so you can run `agent-root` from anywhere:

```bash
pnpm link --global
which agent-root         # should resolve to the linked path
agent-root help
```

If you prefer not to link globally, substitute `node ./dist/bin/agentroot.js`
for `agent-root` in every command below.

## 4. Per-command smoke tests

### help

```bash
agent-root help
```

Expected: exit `0`. Last paragraph mentions `https://agentroot.io/docs/protocol`.

### resolve

```bash
agent-root resolve agentroot.io
```

Expected: exit `0`. Prints a Manifest line plus at least 2 skill records
(`register-domain`, `secondary-sales`) with `skill_md:` URLs.

```bash
agent-root resolve agentroot.io --json | head -20
```

Expected: exit `0`. Valid JSON starting with `{`.

### search

```bash
agent-root search payments
```

Expected: exit `0`. Either prints records or `No records found` (both are
correct — depends on what's in the live registry right now).

```bash
agent-root search payments --json
```

Expected: exit `0`. Valid JSON.

### validate

```bash
# Valid manifest
mkdir -p /tmp/ar-test && cat > /tmp/ar-test/manifest.json <<'EOF'
{
  "version": "1.0",
  "domain": "example.com",
  "records": [
    {
      "id": "test-skill",
      "type": "skill",
      "name": "Test",
      "description": "Demo skill",
      "skill_md": "https://example.com/.well-known/skills/test/SKILL.md"
    }
  ]
}
EOF
agent-root validate /tmp/ar-test/manifest.json
```

Expected: exit `0`. Prints `valid /tmp/ar-test/manifest.json` plus a summary.

```bash
# Invalid manifest (missing domain)
echo '{"version":"1.0","records":[]}' > /tmp/ar-test/bad.json
agent-root validate /tmp/ar-test/bad.json
```

Expected: exit `1`. Prints `invalid ...` and lists `Missing required field: "domain"`.

### init

```bash
mkdir -p /tmp/ar-init && cd /tmp/ar-init
agent-root init
ls .well-known/
```

Expected: exit `0`. Creates `.well-known/agentroot.json`. Next-steps banner
prints `1. Edit .well-known/agentroot.json with your records`.

```bash
cd - && rm -rf /tmp/ar-init
```

### list

```bash
agent-root list
```

Expected: exit `0`. Either prints installed records or "No records installed."
Run this before and after `install` below to see the change.

```bash
agent-root list --json
```

Expected: exit `0`. Valid JSON array.

### config

```bash
# Use a temp HOME so this doesn't touch your real config
export AR_TEST_HOME=$(mktemp -d /tmp/ar-config-home.XXXXXX)

HOME=$AR_TEST_HOME agent-root config get
HOME=$AR_TEST_HOME agent-root config set api-base https://test.example.com
HOME=$AR_TEST_HOME agent-root config get api-base
HOME=$AR_TEST_HOME cat $AR_TEST_HOME/.agentroot/config.json

rm -rf $AR_TEST_HOME && unset AR_TEST_HOME
```

Expected:
- `config get` (first run) prints "No configuration set. Defaults in use."
- `config set ...` prints "Saved to .../.agentroot/config.json"
- `config get api-base` prints `api-base = https://test.example.com`
- The config file contains `{"api-base":"https://test.example.com"}`.

### install / list / update / uninstall (end-to-end)

```bash
WORKDIR=$(mktemp -d /tmp/ar-install.XXXXXX)
ARHOME=$(mktemp -d /tmp/ar-install-home.XXXXXX)
cd $WORKDIR

# Install the secondary-sales skill into ./agents/skills/
HOME=$ARHOME agent-root install agentroot.io/secondary-sales --tool agents --project

ls .agents/skills/secondary-sales/SKILL.md       # must exist
HOME=$ARHOME agent-root list                     # shows the install

# Re-fetch (should be a no-op since version_hash matches)
HOME=$ARHOME agent-root update agentroot.io/secondary-sales --tool agents --project

# Tear it down
HOME=$ARHOME agent-root uninstall agentroot.io/secondary-sales --tool agents --project

cd - && rm -rf $WORKDIR $ARHOME
```

Expected:
- `install` exit `0`. Prints `installed secondary-sales -> .agents/skills/secondary-sales/SKILL.md` and `1 skill(s) installed successfully`.
- `list` exit `0`. Shows `secondary-sales [Skill] (agentroot.io)`.
- `update` exit `0`. Prints `Already up to date - no changes`.
- `uninstall` exit `0`. Prints `removed agents: ...` and `uninstalled (1 tool copies removed)`.

## 5. Cleanup (remove the global link)

```bash
pnpm unlink --global
which agent-root          # should now print nothing
```

## 6. Comparison with the monorepo CLI (optional)

If you have the agentroot monorepo checked out alongside this repo, you can
diff output side-by-side to confirm behavioral parity:

```bash
CLI=$(pwd)/dist/bin/agentroot.js
MONO=../agentroot/packages/cli/dist/bin/agentroot.js

# Build the monorepo CLI first if you haven't:
# (cd ../agentroot && pnpm --filter agent-root build)

diff <(node $CLI resolve agentroot.io) <(node $MONO resolve agentroot.io)
diff <(node $CLI search payments --json) <(node $MONO search payments --json)
diff <(node $CLI list --json) <(node $MONO list --json)
```

Expected: zero differences for `resolve` and `search`. `list` output should
also match (same on-disk store).

For `install --json` parity (paths embed `$HOME` and `$PWD`, so normalize
those before diffing):

```bash
W1=$(mktemp -d) H1=$(mktemp -d) W2=$(mktemp -d) H2=$(mktemp -d)
cd $W1 && HOME=$H1 node $CLI  install agentroot.io/secondary-sales --tool agents --project --json > /tmp/c.json
cd $W2 && HOME=$H2 node $MONO install agentroot.io/secondary-sales --tool agents --project --json > /tmp/m.json
sed "s|$H1|H|g;s|$W1|W|g" /tmp/c.json > /tmp/cn.json
sed "s|$H2|H|g;s|$W2|W|g" /tmp/m.json > /tmp/mn.json
diff /tmp/cn.json /tmp/mn.json    # should be empty
cd - && rm -rf $W1 $H1 $W2 $H2 /tmp/c.json /tmp/m.json /tmp/cn.json /tmp/mn.json
```

Expected: zero diff.
