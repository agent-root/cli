#!/usr/bin/env node
// Captures terminal-style PNG screenshots of agent-root CLI commands for
// the README tutorial. Runs each command, converts the ANSI output to a
// styled HTML page, and uses Playwright Chromium to take the screenshot.
//
// Run with: pnpm run screenshots
// Requires playwright + ansi-to-html as devDependencies.

import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const cli = path.join(repoRoot, 'dist/bin/agentroot.js')
const outDir = path.join(repoRoot, 'docs/screenshots')

mkdirSync(outDir, { recursive: true })

// The recipes to capture. Each is named for the resulting PNG filename
// and lists the argv passed to the CLI. Some use a temp HOME / cwd so
// they don't pollute the user's actual setup.
const recipes = [
  {
    name: 'help',
    title: '$ agent-root help',
    argv: ['help'],
  },
  {
    name: 'resolve',
    title: '$ agent-root resolve doma.xyz',
    argv: ['resolve', 'doma.xyz'],
  },
  {
    name: 'search',
    title: '$ agent-root search doma',
    argv: ['search', 'doma'],
  },
  {
    name: 'validate',
    title: '$ agent-root validate ./agentroot.json',
    argv: ['validate', '__VALID_MANIFEST__'],
    prepare: (workdir) => {
      const manifestPath = path.join(workdir, 'agentroot.json')
      writeFileSync(manifestPath, JSON.stringify({
        domain: 'example.com',
        records: [
          { id: 'docs-helper', type: 'skill', name: 'Docs Helper', description: 'Summarizes documentation pages.', skill_md: 'https://example.com/.well-known/skills/docs-helper.md' },
          { id: 'inbox', type: 'mcp', name: 'Inbox', description: 'Read and triage email.', endpoint: 'https://example.com/mcp/inbox', transport: 'http' },
        ],
      }, null, 2))
      return manifestPath
    },
  },
  {
    name: 'init',
    title: '$ agent-root init --domain example.com',
    argv: ['init', '--domain', 'example.com'],
    chdirToTmp: true,
  },
  {
    name: 'install',
    title: '$ agent-root install doma.xyz/doma-protocol --tool agents --project',
    argv: ['install', 'doma.xyz/doma-protocol', '--tool', 'agents', '--project'],
    chdirToTmp: true,
  },
  {
    name: 'list',
    title: '$ agent-root list',
    argv: ['list'],
  },
  {
    name: 'uninstall',
    title: '$ agent-root uninstall doma.xyz/doma-protocol --tool agents --project --yes',
    argv: ['uninstall', 'doma.xyz/doma-protocol', '--tool', 'agents', '--project', '--yes'],
    chdirToTmp: true,
    prepare: (workdir) => {
      // Pre-seed an install so the uninstall has something to remove.
      spawnSync('node', [cli, 'install', 'doma.xyz/doma-protocol', '--tool', 'agents', '--project'], {
        cwd: workdir, env: { ...process.env, FORCE_COLOR: '1' },
      })
      return null
    },
  },
  {
    name: 'health',
    title: '$ agent-root health',
    argv: ['health'],
  },
  {
    name: 'manifests',
    title: '$ agent-root manifests --query doma --limit 3',
    argv: ['manifests', '--query', 'doma', '--limit', '3'],
  },
  {
    name: 'collections',
    title: '$ agent-root collections',
    argv: ['collections'],
  },
]

function ansiToHtmlPage(title, body) {
  // Minimal inline CSS, no external fonts, deterministic rendering.
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title>
<style>
  body { margin: 0; background: #0d1117; color: #c9d1d9; font-family: 'SF Mono', 'Menlo', 'Consolas', monospace; font-size: 14px; line-height: 1.5; padding: 16px; }
  .window { background: #161b22; border: 1px solid #30363d; border-radius: 8px; overflow: hidden; box-shadow: 0 12px 32px rgba(0,0,0,0.35); }
  .titlebar { background: #21262d; padding: 8px 14px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #30363d; }
  .dot { width: 12px; height: 12px; border-radius: 50%; }
  .red { background: #ff5f57; } .yellow { background: #febc2e; } .green { background: #28c840; }
  .title { color: #8b949e; font-size: 12px; margin-left: 12px; }
  .body { padding: 16px 18px; overflow-x: auto; }
  .prompt { color: #56d364; }
  .cmd { color: #c9d1d9; }
  pre { margin: 0; white-space: pre; font-family: inherit; }
  /* ansi-to-html outputs <span style="color:..."> already */
</style></head>
<body>
  <div class="window">
    <div class="titlebar">
      <span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span>
      <span class="title">agent-root</span>
    </div>
    <div class="body">
      <pre><span class="prompt">$</span> <span class="cmd">${title.replace(/^\$ /, '')}</span></pre>
      <pre>${body}</pre>
    </div>
  </div>
</body>
</html>`
}

async function main() {
  const ansiToHtml = (await import('ansi-to-html')).default
  const { chromium } = await import('playwright')

  const converter = new ansiToHtml({
    bg: '#161b22',
    fg: '#c9d1d9',
    colors: {
      0: '#484f58', 1: '#ff7b72', 2: '#7ee787', 3: '#d29922',
      4: '#79c0ff', 5: '#d2a8ff', 6: '#a5d6ff', 7: '#c9d1d9',
      8: '#6e7681', 9: '#ffa198', 10: '#7ee787', 11: '#e3b341',
      12: '#79c0ff', 13: '#d2a8ff', 14: '#a5d6ff', 15: '#f0f6fc',
    },
    escapeXML: true,
    stream: false,
  })

  const browser = await chromium.launch()
  const context = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 980, height: 600 } })
  const page = await context.newPage()

  for (const recipe of recipes) {
    const workdir = mkdtempSync(path.join(tmpdir(), `agent-root-shot-${recipe.name}-`))
    try {
      let preparedArg = null
      if (recipe.prepare) {
        preparedArg = recipe.prepare(workdir)
      }

      const argv = recipe.argv.map(a => a === '__VALID_MANIFEST__' ? preparedArg : a)
      const cwd = recipe.chdirToTmp ? workdir : process.cwd()

      const result = spawnSync('node', [cli, ...argv], {
        cwd, env: { ...process.env, FORCE_COLOR: '1' }, encoding: 'utf8',
      })
      const output = (result.stdout || '') + (result.stderr || '')
      const truncated = output.length > 6000 ? output.slice(0, 6000) + '\n…(truncated)\n' : output
      const html = converter.toHtml(truncated)

      await page.setContent(ansiToHtmlPage(recipe.title, html))
      // Tight crop to actual content height.
      const bodyEl = await page.$('body')
      const box = await bodyEl.boundingBox()
      await page.setViewportSize({ width: Math.max(960, Math.ceil(box.width)), height: Math.max(200, Math.ceil(box.height) + 4) })

      const outPath = path.join(outDir, `${recipe.name}.png`)
      await page.screenshot({ path: outPath, fullPage: true })
      console.log(`✓ ${outPath}`)
    } finally {
      rmSync(workdir, { recursive: true, force: true })
    }
  }

  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
