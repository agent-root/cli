import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import pc from 'picocolors';
import { scanInstalled } from '@agent-root/core';
import { installSkill } from '../../commands/install-helpers.js';
import type { JsonOut } from '../../commands/install.js';

/**
 * Skills that ship with AgentRoot and are auto-installed on first use.
 * These are universal skills that every user benefits from.
 * The URLs are stable — the skill content is maintained by the publishers.
 */
const DEFAULT_SKILLS: Array<{
  domain: string;
  id: string;
  name: string;
  skill_md: string;
  description: string;
}> = [
  {
    domain: 'doma.xyz',
    id: 'secondary-sales',
    name: 'Domain Secondary Sales',
    skill_md: 'https://doma.xyz/.well-known/skills/secondary-sales/SKILL.md',
    description: 'Buy domains listed on Doma marketplace or make offers to owners',
  },
];

const DEFAULTS_MARKER = path.join(os.homedir(), '.agents', '.defaults-installed');

function alreadyInstalled(): boolean {
  return fs.existsSync(DEFAULTS_MARKER);
}

function markInstalled(): void {
  fs.mkdirSync(path.dirname(DEFAULTS_MARKER), { recursive: true });
  fs.writeFileSync(DEFAULTS_MARKER, JSON.stringify({ installed_at: new Date().toISOString(), skills: DEFAULT_SKILLS.map(s => s.id) }));
}

function hasSkillInstalled(skillId: string): boolean {
  return scanInstalled().some(s => s.record_id === skillId);
}

/**
 * Install default skills if not already installed.
 * Called once on first CLI usage. Skips silently if already done.
 * Pass quiet=true to suppress output (for non-interactive/JSON contexts).
 */
export async function ensureDefaults(flags: Record<string, unknown>): Promise<void> {
  if (alreadyInstalled()) return;

  const quiet = !!flags.json;
  const missing = DEFAULT_SKILLS.filter(s => !hasSkillInstalled(s.id));

  if (missing.length === 0) {
    markInstalled();
    return;
  }

  if (!quiet) {
    console.log(`${pc.dim('First run — installing default skills...')}`);
  }

  for (const skill of missing) {
    const record: Record<string, unknown> = { type: 'skill', id: skill.id, name: skill.name, skill_md: skill.skill_md };
    const jsonOut: JsonOut = { status: 'success', domain: skill.domain, recordId: skill.id, type: 'skill', installed: [], skipped: [], errors: [] };

    try {
      await installSkill({
        domain: skill.domain,
        recordId: skill.id,
        record,
        manifest: null,
        installAll: false,
        isProject: false,
        flags: { ...flags, _quiet: true },
        jsonOut,
      });
      if (!quiet && jsonOut.errors.length === 0) {
        console.log(`  ${pc.green('✓')} ${skill.name}`);
      }
    } catch {
      // Non-fatal — don't block the user's command
    }
  }

  markInstalled();

  if (!quiet) {
    console.log(`${pc.dim('Done. Use `agentroot list` to see installed skills.')}\n`);
  }
}
