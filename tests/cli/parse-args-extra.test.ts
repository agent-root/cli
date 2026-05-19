import { describe, it, expect } from 'vitest';
import { parseArgs, toCamelCase, applyEnvDefaults } from '../../src/cli/parse-args';

// Top-up coverage for parse-args.ts — the existing tests/lib/format.test.ts
// already covers the bulk; here we cover the residual branches:
//  - --no-* negation on a value-style flag (`--no-tool=foo` style),
//  - `--key=value` inline value path for non-boolean flags,
//  - `--` end-of-options separator,
//  - `--no-install` and `--no-color` "positive no" branch,
//  - `toCamelCase` standalone calls.

describe('parseArgs additional branches', () => {
  it('--no-install is treated as a positive boolean flag', () => {
    const r = parseArgs(['node', 'agentroot', 'install', 'x.com', '--no-install']);
    expect(r.flags['noInstall']).toBe(true);
  });

  it('--no-color is treated as a positive boolean flag', () => {
    const r = parseArgs(['node', 'agentroot', '--no-color']);
    expect(r.flags['noColor']).toBe(true);
  });

  it('--no-json sets json=false (POSIX negation)', () => {
    const r = parseArgs(['node', 'agentroot', 'install', 'x.com', '--no-json']);
    expect(r.flags['json']).toBe(false);
  });

  it('--no-install=false explicitly disables the positive-no flag', () => {
    const r = parseArgs(['node', 'agentroot', 'install', 'x.com', '--no-install=false']);
    expect(r.flags['noInstall']).toBe(false);
  });

  it('--no-json=true sets json=true (negated explicitly to truthy)', () => {
    const r = parseArgs(['node', 'agentroot', 'install', '--no-json=true']);
    expect(r.flags['json']).toBe(true);
  });

  it('--key=value sets the string value', () => {
    const r = parseArgs(['node', 'agentroot', 'install', '--tool=claude']);
    expect(r.flags['tool']).toBe('claude');
  });

  it('--all=false coerces the boolean flag off', () => {
    const r = parseArgs(['node', 'agentroot', 'manifests', '--all=false']);
    expect(r.flags['all']).toBe(false);
  });

  it('--all=true coerces the boolean flag on', () => {
    const r = parseArgs(['node', 'agentroot', 'manifests', '--all=true']);
    expect(r.flags['all']).toBe(true);
  });

  it('-- end-of-options puts subsequent args into positional', () => {
    const r = parseArgs(['node', 'agentroot', 'config', '--', '--not-a-flag', 'positional']);
    expect(r.positional).toContain('--not-a-flag');
    expect(r.positional).toContain('positional');
  });

  it('treats first-token-as-flag (no cmd) correctly', () => {
    const r = parseArgs(['node', 'agentroot', '--version']);
    expect(r.cmd).toBeUndefined();
    expect(r.flags['version']).toBe(true);
  });

  it('multi-character single-dash token is NOT a short alias', () => {
    const r = parseArgs(['node', 'agentroot', 'install', '-foo']);
    // -foo isn't isShortAlias, falls into the "not starts with --" branch as positional.
    expect(r.positional).toContain('-foo');
  });

  it('--key with -- prefixed next arg keeps the flag as boolean', () => {
    const r = parseArgs(['node', 'agentroot', 'install', '--limit', '--json']);
    expect(r.flags['limit']).toBe(true);
    expect(r.flags['json']).toBe(true);
  });
});

describe('toCamelCase', () => {
  it('converts kebab-case', () => {
    expect(toCamelCase('no-install')).toBe('noInstall');
  });

  it('converts snake_case', () => {
    expect(toCamelCase('no_install')).toBe('noInstall');
  });

  it('preserves a single word', () => {
    expect(toCamelCase('json')).toBe('json');
  });
});

describe('applyEnvDefaults', () => {
  it('sets yes=true when AGENTROOT_YES is non-empty and yes is unset', () => {
    const flags: Record<string, string | boolean> = {};
    applyEnvDefaults(flags, { AGENTROOT_YES: '1' });
    expect(flags['yes']).toBe(true);
  });

  it('does not overwrite explicit yes=false from the CLI', () => {
    const flags: Record<string, string | boolean> = { yes: false };
    applyEnvDefaults(flags, { AGENTROOT_YES: '1' });
    expect(flags['yes']).toBe(false);
  });

  it('sets yes=true when CI is non-empty', () => {
    const flags: Record<string, string | boolean> = {};
    applyEnvDefaults(flags, { CI: 'true' });
    expect(flags['yes']).toBe(true);
  });

  it('sets json=true when AGENTROOT_JSON is set', () => {
    const flags: Record<string, string | boolean> = {};
    applyEnvDefaults(flags, { AGENTROOT_JSON: '1' });
    expect(flags['json']).toBe(true);
  });

  it('does NOT set json=true under CI alone (per the comment)', () => {
    const flags: Record<string, string | boolean> = {};
    applyEnvDefaults(flags, { CI: 'true' });
    expect(flags['json']).toBeUndefined();
  });

  it('sets noColor=true when NO_COLOR is set', () => {
    const flags: Record<string, string | boolean> = {};
    applyEnvDefaults(flags, { NO_COLOR: '1' });
    expect(flags['noColor']).toBe(true);
  });

  it('sets noColor=true when AGENTROOT_NO_COLOR is set', () => {
    const flags: Record<string, string | boolean> = {};
    applyEnvDefaults(flags, { AGENTROOT_NO_COLOR: '1' });
    expect(flags['noColor']).toBe(true);
  });

  it('sets noColor=true under CI', () => {
    const flags: Record<string, string | boolean> = {};
    applyEnvDefaults(flags, { CI: '1' });
    expect(flags['noColor']).toBe(true);
  });

  it('respects explicit noColor=false from CLI', () => {
    const flags: Record<string, string | boolean> = { noColor: false };
    applyEnvDefaults(flags, { NO_COLOR: '1' });
    expect(flags['noColor']).toBe(false);
  });

  it('uses process.env by default', () => {
    const flags: Record<string, string | boolean> = {};
    // Just verify the call doesn't throw when env is omitted.
    applyEnvDefaults(flags);
  });
});
