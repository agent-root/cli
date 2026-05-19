import { colors } from '../../cli/colors';
import { fatal } from '../../cli/fatal';
import { detectTargetTools } from './detect-target-tools';
import { gatherSkillsToInstall } from './gather-skills';
import { installOneSkill } from './install-one-skill';
import type { InstallSkillOptions } from '../../types/install';

/**
 * Orchestrator: detect target tools → gather skills → install each one.
 * Errors are accumulated in opts.jsonOut; only the "no skills found at all"
 * case is fatal.
 */
export async function installSkill(opts: InstallSkillOptions): Promise<void> {
  const { domain, recordId, installAll, isProject, flags, jsonOut } = opts;

  const tools = detectTargetTools(flags);
  const skillsToInstall = await gatherSkillsToInstall(opts);

  if (skillsToInstall.length === 0) {
    fatal(
      `No skills found for ${installAll ? domain : domain + '/' + recordId}`,
      'Is the record ID correct? Try: agentroot resolve ' + domain,
    );
  }

  jsonOut.type = 'skill';

  let installed = 0;
  for (const skill of skillsToInstall) {
    installed += await installOneSkill(skill, domain, tools, isProject, flags, jsonOut);
  }

  if (installed > 0 && !flags['json'] && !flags['_quiet']) {
    console.log(`\n${colors.green('✓')} ${installed} skill(s) installed successfully`);
  }
}
