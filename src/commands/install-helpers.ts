// Filesystem helpers and skill installation logic extracted from install.ts
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import pc from 'picocolors';
import {
  detectTools, resolveToolDir, hashContent, writeSkill, parseSupportingFiles,
  upsertInstalled, type InstalledToolEntry,
} from '@agent-root/core';
import { fetch, fetchJSON } from '../lib/fetch';
import { getApiBase } from '../lib/config';
import { fatal, maybeSpinner } from '../lib/format';
import type { SkillMeta, JsonOut } from './install';

export function ensureCanonicalStore(domain: string, recordId: string): string {
  const canonicalDir = path.join(os.homedir(), '.agents', 'skills', domain, recordId);
  fs.mkdirSync(canonicalDir, { recursive: true });
  return canonicalDir;
}

export function createSymlink(targetDir: string, linkPath: string): string {
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  try {
    const stat = fs.lstatSync(linkPath);
    if (stat.isSymbolicLink() || stat.isDirectory()) {
      fs.rmSync(linkPath, { recursive: true });
    }
  } catch {}

  if (process.platform === 'win32') {
    try {
      fs.symlinkSync(path.resolve(targetDir), linkPath, 'junction');
      return 'junction';
    } catch {
      fs.cpSync(targetDir, linkPath, { recursive: true });
      return 'copy';
    }
  } else {
    fs.symlinkSync(path.resolve(targetDir), linkPath);
    return 'symlink';
  }
}

export function updateGlobalManifest(domain: string, recordId: string, tools: string[], linkTypes: Record<string, string>, skillMeta: { name: string; versionHash: string; url: string }): void {
  const toolsMap: Record<string, InstalledToolEntry> = {};
  for (const tool of tools) {
    const baseDir = resolveToolDir(tool, false);
    toolsMap[tool] = {
      path: path.join(baseDir, domain, recordId),
      link_type: linkTypes[tool] ?? 'symlink',
    };
  }

  upsertInstalled({
    domain,
    record_id: recordId,
    type: 'skill',
    name: skillMeta.name,
    source_url: skillMeta.url,
    version_hash: skillMeta.versionHash,
    tools: toolsMap,
  });
}

/**
 * Extract a skill URL from a record or index entry.
 * Handles multiple field name conventions: skill_md, skill_md_url, file, url.
 */
function extractSkillUrl(entry: Record<string, unknown>): string | undefined {
  return (entry['skill_md'] || entry['skill_md_url'] || entry['file'] || entry['url']) as string | undefined;
}

/**
 * Extract a skill ID from a record or index entry.
 * Handles: skill_id, slug, id. Prefers string fields over numeric DB IDs.
 * Always returns a string — coerces numbers to strings.
 */
function extractSkillId(entry: Record<string, unknown>, fallback: string): string {
  const raw = entry['skill_id'] || entry['slug'] || entry['id'] || fallback;
  return String(raw);
}

/**
 * Extract a skill name from a record or index entry.
 * Handles: name, title. Always returns a string.
 */
function extractSkillName(entry: Record<string, unknown>, fallback: string): string {
  const raw = entry['name'] || entry['title'] || fallback;
  return String(raw);
}

export async function resolveSkillsFromRecord(record: Record<string, unknown>, domain: string, recordId: string, flags: Record<string, unknown>): Promise<SkillMeta[]> {
  const skills: SkillMeta[] = [];

  const directUrl = extractSkillUrl(record);
  if (directUrl) {
    skills.push({ id: extractSkillId(record, recordId), name: extractSkillName(record, recordId), description: (record['description'] as string) || '', url: directUrl, domain });
  } else if (record['skills'] && Array.isArray(record['skills'])) {
    for (const s of record['skills'] as Array<Record<string, unknown>>) {
      const url = extractSkillUrl(s);
      if (url) {
        skills.push({ id: extractSkillId(s, recordId), name: extractSkillName(s, recordId), description: (s['description'] as string) || '', url, domain });
      }
    }
  }

  // Also check index.json if present — may have additional skills or be the only source
  if (record['index'] && skills.length === 0) {
    const indexSpinner = maybeSpinner('Fetching index ' + record['index'] + '...', flags).start();
    try {
      const idx = await fetchJSON<{ skills?: Array<Record<string, unknown>> }>(record['index'] as string);
      if (idx.skills && Array.isArray(idx.skills)) {
        for (const s of idx.skills) {
          const url = extractSkillUrl(s);
          if (url) {
            skills.push({ id: extractSkillId(s, recordId), name: extractSkillName(s, recordId), description: (s['description'] as string) || '', url, domain });
          }
        }
      }
      indexSpinner.success({ text: 'Loaded skill index' });
    } catch (err) {
      indexSpinner.error({ text: 'Could not fetch skill index' });
      console.log(`${pc.yellow('warning')} Could not fetch skill index: ${(err as Error).message}`);
    }
  }

  return skills;
}

export async function fetchSkillsFromRegistry(domain: string, recordId: string | null, installAll: boolean, flags: Record<string, unknown>): Promise<SkillMeta[]> {
  const skills: SkillMeta[] = [];
  try {
    if (installAll) {
      const regSpinner = maybeSpinner('Fetching skills for ' + domain + ' from registry...', flags).start();
      const data = await fetchJSON<{ skill?: { skills?: Array<Record<string, unknown>> } }>(`${getApiBase()}/api/skills/${encodeURIComponent(domain)}`);
      if (data.skill && data.skill.skills) {
        for (const s of data.skill.skills) {
          const url = extractSkillUrl(s);
          if (url) {
            skills.push({ id: extractSkillId(s, ''), name: extractSkillName(s, ''), description: (s['description'] as string) || '', url, domain });
          }
        }
        regSpinner.success({ text: 'Found ' + skills.length + ' skill(s) in registry' });
      } else {
        regSpinner.warn({ text: 'No skills found in registry' });
      }
    } else {
      const regSpinner = maybeSpinner('Fetching ' + domain + '/' + recordId + ' from registry...', flags).start();
      const data = await fetchJSON<{ skill?: Record<string, unknown> }>(`${getApiBase()}/api/skills/${encodeURIComponent(domain)}/item/${encodeURIComponent(recordId || '')}`);
      if (data.skill) {
        const s = data.skill;
        const url = extractSkillUrl(s);
        if (url) {
          skills.push({ id: extractSkillId(s, recordId || ''), name: extractSkillName(s, recordId || ''), description: (s['description'] as string) || '', url, domain });
        }
        regSpinner.success({ text: 'Found ' + extractSkillName(s, recordId || '') + ' in registry' });
      } else {
        regSpinner.warn({ text: 'No skill found in registry' });
      }
    }
  } catch {}
  return skills;
}

export async function installSkill(domain: string, recordId: string | null, record: Record<string, unknown> | null, manifest: Record<string, unknown> | null, installAll: boolean, isProject: boolean, flags: Record<string, unknown>, jsonOut: JsonOut): Promise<void> {
  let tools: string[] = [];
  if ((flags['_selectedTools'] as string[]) && (flags['_selectedTools'] as string[]).length > 0) {
    tools = flags['_selectedTools'] as string[];
  } else if (flags['tool']) {
    tools = [flags['tool'] as string];
  } else {
    tools = detectTools();
    if (tools.length === 0) {
      tools = ['agents'];
      if (!flags['json']) console.log(`${pc.dim('No AI tools detected, using cross-tool .agents/skills/ directory')}`);
    } else {
      if (!flags['json']) console.log(`${pc.dim(`Detected tools: ${tools.join(', ')}`)}`);
    }
  }

  let skillsToInstall: SkillMeta[] = [];

  if (record && !installAll) {
    skillsToInstall = await resolveSkillsFromRecord(record, domain, recordId || '', flags);
  } else if (manifest && installAll) {
    const skillRecords = ((manifest['records'] as Array<Record<string, unknown>>) || []).filter(r => r['type'] === 'skill');
    for (const sr of skillRecords) {
      const resolved = await resolveSkillsFromRecord(sr, domain, sr['id'] as string, flags);
      skillsToInstall.push(...resolved);
    }
  }

  if (skillsToInstall.length === 0) {
    skillsToInstall = await fetchSkillsFromRegistry(domain, recordId, installAll, flags);
  }

  if (skillsToInstall.length === 0) {
    fatal(`No skills found for ${installAll ? domain : domain + '/' + recordId}`, 'Is the record ID correct? Try: agentroot resolve ' + domain);
  }

  jsonOut.type = 'skill';

  let installed = 0;
  for (const skill of skillsToInstall) {
    if (!skill.url) {
      if (!flags['json']) console.log(`${pc.yellow('skip')} ${skill.id} — no SKILL.md URL`);
      jsonOut.skipped.push({ id: skill.id, reason: 'no SKILL.md URL' });
      continue;
    }

    let content: string;
    try {
      content = await fetch(skill.url);
    } catch (err) {
      if (!flags['json']) console.log(`${pc.red('fail')} ${skill.id} — could not fetch SKILL.md: ${(err as Error).message}`);
      jsonOut.errors.push({ id: skill.id, error: (err as Error).message });
      continue;
    }

    // Fetch supporting files referenced via relative links in SKILL.md
    const supportingPaths = parseSupportingFiles(content);
    const supportingFiles: Record<string, string> = {};
    if (supportingPaths.length > 0) {
      const baseUrl = skill.url.substring(0, skill.url.lastIndexOf('/') + 1);
      for (const relPath of supportingPaths) {
        const fileUrl = new URL(relPath, baseUrl).href;
        try {
          supportingFiles[relPath] = await fetch(fileUrl);
        } catch {
          // Skip files that can't be fetched (404, etc.)
        }
      }
    }

    const skillDomain = skill.domain || domain;
    const versionHash = hashContent(content);
    const perSkillManifest: Record<string, unknown> = {
      source_domain: skillDomain, record_id: skill.id, type: 'skill',
      name: skill.name, description: skill.description,
      skill_md_url: skill.url, installed_at: new Date().toISOString(), version_hash: versionHash,
    };

    const canonicalDir = ensureCanonicalStore(skillDomain, skill.id);
    writeSkill(canonicalDir, content, { ...perSkillManifest, tool: 'canonical' }, supportingFiles);

    const linkTypes: Record<string, string> = {};
    for (const tool of tools) {
      if (isProject) {
        const baseDir = resolveToolDir(tool, true);
        const skillDir = path.join(baseDir, skill.id);
        const skillPath = path.join(skillDir, 'SKILL.md');
        writeSkill(skillDir, content, { ...perSkillManifest, tool }, supportingFiles);
        linkTypes[tool] = 'copy';
        if (!flags['json']) console.log(`${pc.green('installed')} ${pc.bold(skill.id)} → ${skillPath}`);
        jsonOut.installed.push({ tool, path: skillPath, id: skill.id, link_type: 'copy' });
      } else {
        const baseDir = resolveToolDir(tool, false);
        const toolSkillDir = path.join(baseDir, skillDomain, skill.id);
        const linkType = createSymlink(canonicalDir, toolSkillDir);
        linkTypes[tool] = linkType;
        if (!flags['json'] && !flags['_quiet']) console.log(`${pc.green('linked')} ${pc.bold(skill.id)} → ${toolSkillDir} (${linkType})`);
        jsonOut.installed.push({ tool, path: toolSkillDir, id: skill.id, link_type: linkType });
      }
      installed++;
    }

    updateGlobalManifest(skillDomain, skill.id, tools, linkTypes, { name: skill.name, versionHash, url: skill.url });
  }

  if (installed > 0 && !flags['json'] && !flags['_quiet']) {
    console.log(`\n${pc.green('\u2713')} ${installed} skill(s) installed successfully`);
  }
}
