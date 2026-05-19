import path from 'node:path';
import { colors } from '../../cli/colors';
import { resolveToolDir, hashContent, writeSkill, parseSupportingFiles } from '@agent-root/core';
import { fetch } from '../http/fetch';
import { ensureCanonicalStore, createSymlink } from './symlink';
import { updateGlobalManifest } from './update-global-manifest';
import type { SkillMeta, JsonOut } from '../../types/install';

/**
 * Phase 4 of installSkill, install a single skill.
 * Fetches SKILL.md + supporting files, writes to canonical store, links per tool.
 * Returns the number of (tool, skill) pairs successfully installed.
 */
export async function installOneSkill(
  skill: SkillMeta,
  fallbackDomain: string,
  tools: string[],
  isProject: boolean,
  flags: Record<string, unknown>,
  jsonOut: JsonOut,
): Promise<number> {
  if (!skill.url) {
    if (!flags['json']) console.log(`${colors.yellow('skip')} ${skill.id}, no SKILL.md URL`);
    jsonOut.skipped.push({ id: skill.id, reason: 'no SKILL.md URL' });
    return 0;
  }

  let content: string;
  try {
    content = await fetch(skill.url);
  } catch (err) {
    if (!flags['json']) {
      console.log(`${colors.red('fail')} ${skill.id}, could not fetch SKILL.md: ${(err as Error).message}`);
    }
    jsonOut.errors.push({ id: skill.id, error: (err as Error).message });
    return 0;
  }

  // Fetch supporting files referenced via relative links in SKILL.md.
  // Done in parallel, these are independent network calls against the same
  // origin and waiting for them serially can multiply install latency by 10x
  // on skills with many supporting docs.
  const supportingPaths = parseSupportingFiles(content);
  const supportingFiles: Record<string, string> = {};
  if (supportingPaths.length > 0) {
    const baseUrl = skill.url.substring(0, skill.url.lastIndexOf('/') + 1);
    const fetched = await Promise.all(supportingPaths.map(async (relPath) => {
      const fileUrl = new URL(relPath, baseUrl).href;
      try {
        const body = await fetch(fileUrl);
        return { relPath, body };
      } catch {
        // Skip files that can't be fetched (404, etc.)
        return null;
      }
    }));
    for (const entry of fetched) {
      if (entry) supportingFiles[entry.relPath] = entry.body;
    }
  }

  const skillDomain = skill.domain || fallbackDomain;
  const versionHash = hashContent(content);
  const perSkillManifest: Record<string, unknown> = {
    source_domain: skillDomain,
    record_id: skill.id,
    type: 'skill',
    name: skill.name,
    description: skill.description,
    skill_md_url: skill.url,
    installed_at: new Date().toISOString(),
    version_hash: versionHash,
  };

  const canonicalDir = ensureCanonicalStore(skillDomain, skill.id);
  writeSkill(canonicalDir, content, { ...perSkillManifest, tool: 'canonical' }, supportingFiles);

  const linkTypes: Record<string, string> = {};
  let installedCount = 0;
  for (const tool of tools) {
    if (isProject) {
      const baseDir = resolveToolDir(tool, true);
      const skillDir = path.join(baseDir, skill.id);
      const skillPath = path.join(skillDir, 'SKILL.md');
      writeSkill(skillDir, content, { ...perSkillManifest, tool }, supportingFiles);
      linkTypes[tool] = 'copy';
      if (!flags['json']) console.log(`${colors.green('installed')} ${colors.bold(skill.id)} → ${skillPath}`);
      jsonOut.installed.push({ tool, path: skillPath, id: skill.id, link_type: 'copy' });
    } else {
      const baseDir = resolveToolDir(tool, false);
      const toolSkillDir = path.join(baseDir, skillDomain, skill.id);
      const linkType = createSymlink(canonicalDir, toolSkillDir);
      linkTypes[tool] = linkType;
      if (!flags['json'] && !flags['_quiet']) {
        console.log(`${colors.green('linked')} ${colors.bold(skill.id)} → ${toolSkillDir} (${linkType})`);
      }
      jsonOut.installed.push({ tool, path: toolSkillDir, id: skill.id, link_type: linkType });
    }
    installedCount++;
  }

  updateGlobalManifest({
    domain: skillDomain,
    recordId: skill.id,
    tools,
    linkTypes,
    skillMeta: { name: skill.name, versionHash, url: skill.url },
  });

  return installedCount;
}
