import pc from 'picocolors';
import { detectTools } from '@agent-root/core';

/**
 * Phase 1 of installSkill, decide which AI tools to install for.
 * Honors --tool flag, then _selectedTools (from interactive picker),
 * else falls back to detecting installed tools, else cross-tool default.
 * Exported for unit testing.
 */
export function detectTargetTools(flags: Record<string, unknown>): string[] {
  const selected = flags['_selectedTools'] as string[] | undefined;
  if (selected && selected.length > 0) return selected;
  if (flags['tool']) return [flags['tool'] as string];

  const detected = detectTools();
  if (detected.length === 0) {
    if (!flags['json']) console.log(pc.dim('No AI tools detected, using cross-tool .agents/skills/ directory'));
    return ['agents'];
  }
  if (!flags['json']) console.log(pc.dim(`Detected tools: ${detected.join(', ')}`));
  return detected;
}
