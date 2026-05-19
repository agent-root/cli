import { resolveSkillsFromRecord } from './resolve-skills-from-record';
import { fetchSkillsFromRegistry } from './fetch-skills-from-registry';
import type { SkillMeta, InstallSkillOptions } from '../../types/install';

/**
 * Phase 2+3 of installSkill, gather the list of skills to install.
 * Tries record/manifest first, falls back to the registry API.
 */
export async function gatherSkillsToInstall(opts: InstallSkillOptions): Promise<SkillMeta[]> {
  const { domain, recordId, record, manifest, installAll, flags } = opts;
  let skills: SkillMeta[] = [];

  if (record && !installAll) {
    skills = await resolveSkillsFromRecord({ record, domain, recordId: recordId || '', flags });
  } else if (manifest && installAll) {
    const skillRecords = ((manifest['records'] as Array<Record<string, unknown>>) || [])
      .filter(r => r['type'] === 'skill');
    for (const sr of skillRecords) {
      const resolved = await resolveSkillsFromRecord({
        record: sr,
        domain,
        recordId: sr['id'] as string,
        flags,
      });
      skills.push(...resolved);
    }
  }

  if (skills.length === 0) {
    skills = await fetchSkillsFromRegistry({ domain, recordId, installAll, flags });
  }

  return skills;
}
