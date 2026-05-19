import path from 'node:path';
import { resolveToolDir, upsertInstalled, type InstalledToolEntry } from '@agent-root/core';
import type { UpdateGlobalManifestOptions } from '../../types/install';

export function updateGlobalManifest(opts: UpdateGlobalManifestOptions): void {
  const { domain, recordId, tools, linkTypes, skillMeta } = opts;
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
