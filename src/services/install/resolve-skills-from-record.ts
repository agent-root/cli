import pc from 'picocolors';
import { fetchJSON } from '../http/fetch';
import { maybeSpinner } from '../../cli/spinner';
import { extractSkillUrl, extractSkillId, extractSkillName } from './skill-extractors';
import type { SkillMeta, ResolveSkillsFromRecordOptions } from '../../types/install';

export async function resolveSkillsFromRecord(opts: ResolveSkillsFromRecordOptions): Promise<SkillMeta[]> {
  const { record, domain, recordId, flags } = opts;
  const skills: SkillMeta[] = [];

  const directUrl = extractSkillUrl(record);
  if (directUrl) {
    skills.push({
      id: extractSkillId(record, recordId),
      name: extractSkillName(record, recordId),
      description: (record['description'] as string) || '',
      url: directUrl,
      domain,
    });
  } else if (record['skills'] && Array.isArray(record['skills'])) {
    for (const s of record['skills'] as Array<Record<string, unknown>>) {
      const url = extractSkillUrl(s);
      if (url) {
        skills.push({
          id: extractSkillId(s, recordId),
          name: extractSkillName(s, recordId),
          description: (s['description'] as string) || '',
          url,
          domain,
        });
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
            skills.push({
              id: extractSkillId(s, recordId),
              name: extractSkillName(s, recordId),
              description: (s['description'] as string) || '',
              url,
              domain,
            });
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
