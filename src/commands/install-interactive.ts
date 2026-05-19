import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import pc from 'picocolors';
import { detectTools } from '@agent-root/core';
import { maybeSpinner, confirmAction, RECORD_TYPES } from '../lib/format';
import { type SearchResult } from './search';
import { installMcp, installAgent, type JsonOut } from './install';
import { installSkill } from './install-helpers';

async function promptToolSelect(flags: Record<string, unknown>): Promise<string[]> {
  const toolLabels: Record<string, string> = { claude: 'Claude Code', cursor: 'Cursor', codex: 'Codex CLI', gemini: 'Gemini CLI', agents: 'Cross-tool (~/.agents/)' };
  const toolPaths: Record<string, string> = { claude: '~/.claude/skills/', cursor: '.cursor/skills/', codex: '~/.codex/skills/', gemini: '~/.gemini/skills/', agents: '~/.agents/skills/' };
  const allTools = ['claude', 'cursor', 'codex', 'gemini'];
  const detected = detectTools();

  if (detected.length === 0) {
    console.log(`\n  ${pc.dim('No AI tools detected, will install to ~/.agents/skills/')}`);
    return ['agents'];
  }

  console.log(`\n  ${pc.bold('Detected AI tools on your machine:')}`);
  for (const t of allTools) {
    const found = detected.includes(t);
    const icon = found ? pc.green('[+]') : pc.dim('[ ]');
    const label = found ? toolLabels[t] : pc.dim((toolLabels[t] ?? t) + ' (not detected)');
    const p = found ? pc.dim(`(${toolPaths[t] ?? ''})`) : '';
    console.log(`    ${icon} ${label}  ${p}`);
  }
  console.log();

  if (flags['yes'] || !process.stdout.isTTY) return detected;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { checkbox } = require('@inquirer/prompts') as {
    checkbox: (opts: { message: string; choices: Array<{ name: string; value: string; checked: boolean }> }) => Promise<string[]>
  };

  const choices = detected.map(t => ({ name: `${toolLabels[t] ?? t}   ${pc.dim(toolPaths[t] ?? '')}`, value: t, checked: true }));

  let selected: string[];
  try {
    selected = await checkbox({ message: 'Install to which tools?', choices });
  } catch {
    return [];
  }

  if (selected.length === 0) {
    console.log(`  ${pc.dim('No tools selected, cancelled.')}`);
    return [];
  }

  return selected;
}

export async function promptInstallFromResult(result: SearchResult, flags: Record<string, unknown>): Promise<void> {
  const domain = result.domain;
  const recordId = (result.id || result.record_id) as string;
  const jsonOut: JsonOut = { status: 'success', domain, recordId, type: result.type, installed: [], skipped: [], errors: [] };

  if (result.type === 'skill') {
    const tools = await promptToolSelect(flags);
    if (tools.length === 0) return;
    console.log();
    const instSpinner = maybeSpinner(`Fetching ${result.name || recordId} from ${domain}...`, flags).start();
    await installSkill(domain, recordId, result as unknown as Record<string, unknown>, null, false, !!flags['project'], { ...flags, _selectedTools: tools, _quiet: true }, jsonOut);
    instSpinner.success({ text: `Installed ${pc.bold(result.name || recordId)} successfully` });
  } else if (result.type === 'mcp') {
    const tools = await promptToolSelect(flags);
    if (tools.length === 0) return;
    installMcp(domain, recordId, result as unknown as Record<string, unknown>, flags, jsonOut);

    const MCP_CONFIG_PATHS: Record<string, string> = {
      claude: path.join(os.homedir(), '.claude', 'settings.json'),
      cursor: path.join('.cursor', 'mcp.json'),
      codex: path.join(os.homedir(), '.codex', 'config.json'),
    };
    for (const tool of tools) {
      const configPath = MCP_CONFIG_PATHS[tool];
      if (!configPath) continue;
      const shouldWrite = await confirmAction(`Add MCP config to ${tool} (${configPath})?`, flags);
      if (shouldWrite) {
        try {
          let existing: Record<string, unknown> = {};
          try { existing = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>; } catch {}
          if (!existing['mcpServers']) existing['mcpServers'] = {};
          const configKey = `${domain}/${recordId}`;
          const r = result as unknown as Record<string, unknown>;
          const inst = r['install'] as Record<string, unknown> | undefined;
          (existing['mcpServers'] as Record<string, unknown>)[configKey] = r['transport'] === 'http'
            ? { url: r['endpoint'] }
            : { command: inst?.['command'] || 'npx', args: inst?.['args'] || [inst?.['package'] || recordId] };
          fs.mkdirSync(path.dirname(configPath), { recursive: true });
          fs.writeFileSync(configPath, JSON.stringify(existing, null, 2) + '\n');
          console.log(`  ${pc.green('written')} ${configPath}`);
          jsonOut.installed.push({ tool, configPath, type: 'mcp' });
        } catch (err) {
          console.log(`  ${pc.red('fail')} ${tool}: ${(err as Error).message}`);
          jsonOut.errors.push({ tool, error: (err as Error).message });
        }
      }
    }
  } else if (result.type === 'agent' || result.type === 'a2a' || result.type === 'payment') {
    installAgent(domain, recordId, result as unknown as Record<string, unknown>, flags, jsonOut);
  }

  const installedCount = jsonOut.installed.length;
  if (result.type === 'skill' && installedCount > 0) {
    console.log();
    const canonPath = `~/.agents/skills/${domain}/${recordId}`;
    console.log(`  Installing...`);
    console.log(`    ${pc.green('->')} ${canonPath}/SKILL.md ${pc.dim('(canonical)')}`);
    for (const inst of jsonOut.installed) {
      const shortPath = (inst['path'] as string).replace(os.homedir(), '~');
      console.log(`    ${pc.green('->')} ${shortPath} ${pc.dim('->')} ${pc.dim((inst['link_type'] as string) || 'symlink')}`);
    }
    console.log();
    console.log(`  ${pc.green('+')} Installed ${pc.bold('"' + (result.name || recordId) + '"')} to ${installedCount} tool${installedCount > 1 ? 's' : ''}`);
    console.log(`     Source: ${domain} | Verified: ${result.verified ? pc.green('+') : pc.yellow('-')} | Type: ${RECORD_TYPES[result.type] ?? result.type}`);
    console.log();
    console.log(`  ${pc.dim('The skill is now available to your AI tools.')}`);
    console.log(`  ${pc.dim('To update:')} npx agent-root update ${domain}/${recordId}`);
    console.log(`  ${pc.dim('To remove:')} npx agent-root uninstall ${domain}/${recordId}`);
    console.log();
  } else if (result.type === 'mcp' && installedCount > 0) {
    console.log();
    console.log(`  ${pc.green('+')} Configured ${pc.bold('"' + (result.name || recordId) + '"')} MCP server`);
    console.log(`     Source: ${domain} | Type: MCP`);
    for (const inst of jsonOut.installed) {
      console.log(`    ${pc.green('->')} ${inst['configPath'] as string}`);
    }
    console.log();
  } else if (result.type === 'agent' || result.type === 'a2a' || result.type === 'payment') {
    console.log();
    console.log(`  ${pc.cyan('i')} ${pc.bold(result.name || recordId)} (${result.type})`);
    console.log(`     Endpoint: ${result.endpoint || 'not specified'}`);
    console.log(`     Source: ${domain}`);
    if (result.type === 'payment') {
      const raw = result as unknown as Record<string, unknown>;
      if (raw['api_spec']) console.log(`     API Spec: ${raw['api_spec']}`);
      if (Array.isArray(raw['protocols'])) console.log(`     Protocols: ${(raw['protocols'] as string[]).join(', ')}`);
      if (Array.isArray(raw['methods'])) console.log(`     Methods: ${(raw['methods'] as string[]).join(', ')}`);
      if (Array.isArray(raw['assets'])) console.log(`     Assets: ${(raw['assets'] as string[]).join(', ')}`);
    }
    console.log();
  }

  if (flags['json']) {
    console.log(JSON.stringify(jsonOut, null, 2));
  }
}
