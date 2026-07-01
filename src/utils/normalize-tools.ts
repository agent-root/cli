export interface NormalizedTool {
  name: string;
  description?: string;
}

/**
 * Normalize an mcp record's `tools` into a uniform list of named tools.
 * Tolerates the spec shape (`[{ name, description }]`) and the real-world string
 * shape (`["search", …]`), plus mixed/malformed arrays. Entries without a usable
 * name are dropped; non-array input returns [].
 */
export function normalizeTools(tools: unknown): NormalizedTool[] {
  if (!Array.isArray(tools)) return [];
  const out: NormalizedTool[] = [];
  for (const t of tools) {
    if (typeof t === 'string') {
      const name = t.trim();
      if (name) out.push({ name });
    } else if (t && typeof t === 'object' && 'name' in t) {
      const name = String((t as { name: unknown }).name ?? '').trim();
      if (!name) continue;
      const desc = (t as { description?: unknown }).description;
      out.push(typeof desc === 'string' && desc ? { name, description: desc } : { name });
    }
    // else: skip malformed entries (numbers, null, name-less objects)
  }
  return out;
}
