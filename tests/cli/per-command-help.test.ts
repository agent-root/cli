import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  helpResolve, helpSearch, helpInstall, helpList, helpUpdate, helpUninstall,
  helpInit, helpValidate, helpConfig, helpStats, helpHealth, helpManifests,
  helpCollections, helpSubmit, helpVersion,
} from '../../src/commands/help';
import { helpCompletion } from '../../src/commands/completion';

// Each test in this file follows the same pattern: spy on console.log,
// invoke the help function, and assert the captured output contains the
// command name + at least one flag + at least one example. The intent is
// to catch the "I added a new command but forgot to add a help page"
// regression early, plus structural drift (e.g. accidentally deleting the
// EXAMPLES section).
function makeHelpCase(name: string, fn: () => void, alsoMatch: RegExp[] = []) {
  return () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    fn();
    const captured = logSpy.mock.calls.map(c => c[0]).join('\n');
    logSpy.mockRestore();
    expect(captured).toContain(`agentroot ${name}`);
    expect(captured).toMatch(/USAGE/);
    expect(captured).toMatch(/EXAMPLES/);
    expect(captured).toMatch(/EXIT CODES/);
    for (const re of alsoMatch) expect(captured).toMatch(re);
  };
}

describe('per-command help', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    logSpy.mockRestore();
  });

  it('helpResolve prints resolve-specific page', makeHelpCase('resolve', helpResolve, [/--no-install/]));
  it('helpSearch prints search-specific page', makeHelpCase('search', helpSearch, [/--type/, /--limit/]));
  it('helpInstall prints install-specific page', makeHelpCase('install', helpInstall, [/--tool/]));
  it('helpList prints list-specific page', makeHelpCase('list', helpList));
  it('helpUpdate prints update-specific page', makeHelpCase('update', helpUpdate));
  it('helpUninstall prints uninstall-specific page', makeHelpCase('uninstall', helpUninstall, [/--yes/]));
  it('helpInit prints init-specific page', makeHelpCase('init', helpInit, [/--domain/, /--force/]));
  it('helpValidate prints validate-specific page', makeHelpCase('validate', helpValidate));
  it('helpConfig prints config-specific page', makeHelpCase('config', helpConfig, [/api-url/]));
  it('helpStats prints stats-specific page', makeHelpCase('stats', helpStats));
  it('helpHealth prints health-specific page', makeHelpCase('health', helpHealth));
  it('helpManifests prints manifests-specific page', makeHelpCase('manifests', helpManifests, [/--query/]));
  it('helpCollections prints collections-specific page', makeHelpCase('collections', helpCollections));
  it('helpSubmit prints submit-specific page', makeHelpCase('submit', helpSubmit, [/--manifest-url/]));
  it('helpVersion prints version-specific page', makeHelpCase('version', helpVersion));
  it('helpCompletion prints completion-specific page', makeHelpCase('completion', helpCompletion, [/bash/, /zsh/, /fish/]));

  it('every help page lists at least one EXIT CODE', () => {
    // Catch a drift where a help page ships without the exit code table.
    // The smoke test for sysexits depends on these being correct, so even
    // a single missing line is a real-user bug.
    const pages = [
      helpResolve, helpSearch, helpInstall, helpList, helpUpdate, helpUninstall,
      helpInit, helpValidate, helpConfig, helpStats, helpHealth, helpManifests,
      helpCollections, helpSubmit, helpVersion, helpCompletion,
    ];
    for (const fn of pages) {
      logSpy.mockClear();
      fn();
      const captured = logSpy.mock.calls.map(c => c[0]).join('\n');
      // Every page promises at least the 0 (OK / success) row.
      expect(captured).toMatch(/^\s+0\s/m);
    }
  });
});
