import { fetchJSON } from '../http/fetch';
import { getApiBase } from '../config/config-service';
import { maybeSpinner } from '../../cli/spinner';
import { extractSkillUrl, extractSkillId, extractSkillName } from './skill-extractors';
import type { SkillMeta, FetchSkillsFromRegistryOptions } from '../../types/install';

export async function fetchSkillsFromRegistry(opts: FetchSkillsFromRegistryOptions): Promise<SkillMeta[]> {
  const { domain, recordId, installAll, flags } = opts;
  const skills: SkillMeta[] = [];
  try {
    if (installAll) {
      const regSpinner = maybeSpinner('Fetching skills for ' + domain + ' from registry...', flags).start();
      const apiUrl = `${getApiBase()}/api/skills/${encodeURIComponent(domain)}`;
      const data = await fetchJSON<{ skill?: { skills?: Array<Record<string, unknown>> } }>(apiUrl);
      if (data.skill && data.skill.skills) {
        for (const s of data.skill.skills) {
          const url = extractSkillUrl(s);
          if (url) {
            skills.push({
              id: extractSkillId(s, ''),
              name: extractSkillName(s, ''),
              description: (s['description'] as string) || '',
              url,
              domain,
            });
          }
        }
        regSpinner.success({ text: 'Found ' + skills.length + ' skill(s) in registry' });
      } else {
        regSpinner.warn({ text: 'No skills found in registry' });
      }
    } else {
      const regSpinner = maybeSpinner('Fetching ' + domain + '/' + recordId + ' from registry...', flags).start();
      const encDomain = encodeURIComponent(domain);
      const encRecord = encodeURIComponent(recordId || '');
      const apiUrl = `${getApiBase()}/api/skills/${encDomain}/item/${encRecord}`;
      const data = await fetchJSON<{ skill?: Record<string, unknown> }>(apiUrl);
      if (data.skill) {
        const s = data.skill;
        const url = extractSkillUrl(s);
        if (url) {
          skills.push({
            id: extractSkillId(s, recordId || ''),
            name: extractSkillName(s, recordId || ''),
            description: (s['description'] as string) || '',
            url,
            domain,
          });
        }
        regSpinner.success({ text: 'Found ' + extractSkillName(s, recordId || '') + ' in registry' });
      } else {
        regSpinner.warn({ text: 'No skill found in registry' });
      }
    }
  } catch {
    // Registry might be down, network might be flaky, or the domain
    // might genuinely have no skills, all three are "return empty"
    // outcomes. The caller decides whether empty means failure.
  }
  return skills;
}
