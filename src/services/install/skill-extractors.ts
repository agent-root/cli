/**
 * Field-name normalization helpers used by skill resolution.
 * Different sources (registry, manifest, index.json) use different field names
 * for the same logical concept, these helpers paper over those differences.
 */

/**
 * Extract a skill URL from a record or index entry.
 * Handles multiple field name conventions: skill_md, skill_md_url, file, url.
 */
export function extractSkillUrl(entry: Record<string, unknown>): string | undefined {
  return (entry['skill_md'] || entry['skill_md_url'] || entry['file'] || entry['url']) as string | undefined;
}

/**
 * Extract a skill ID from a record or index entry.
 * Handles: skill_id, slug, id. Prefers string fields over numeric DB IDs.
 * Always returns a string, coerces numbers to strings.
 */
export function extractSkillId(entry: Record<string, unknown>, fallback: string): string {
  const raw = entry['skill_id'] || entry['slug'] || entry['id'] || fallback;
  return String(raw);
}

/**
 * Extract a skill name from a record or index entry.
 * Handles: name, title. Always returns a string.
 */
export function extractSkillName(entry: Record<string, unknown>, fallback: string): string {
  const raw = entry['name'] || entry['title'] || fallback;
  return String(raw);
}
