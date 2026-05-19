import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

// Resolve the compiled CLI once. These tests assume `pnpm build` has run
// (CI does this before vitest); a missing dist/ is reported by the first
// failing case rather than a setup-time crash.
const CLI = path.resolve(__dirname, '..', '..', 'dist', 'bin', 'agentroot.js');

function run(args: string[], opts: { input?: string } = {}): { stdout: string; stderr: string; code: number } {
  const result = spawnSync('node', [CLI, ...args], {
    encoding: 'utf-8',
    input: opts.input,
    // Strip env so the user's NO_COLOR / CI / AGENTROOT_* don't leak in.
    env: { PATH: process.env['PATH'] ?? '', HOME: process.env['HOME'] ?? '' },
  });
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '', code: result.status ?? 0 };
}

describe('CLI integration smoke', () => {
  it('non-TTY with no args exits USAGE (2)', () => {
    // Piping `</dev/null` simulates a script call. The CLI should NOT drop
    // into the interactive picker and should NOT exit 0; it should return
    // sysexits USAGE so scripts can detect the bug.
    const res = run([], { input: '' });
    expect(res.code).toBe(2);
  });

  it('unknown command exits USAGE (2)', () => {
    const res = run(['definitely-not-a-real-subcommand']);
    expect(res.code).toBe(2);
    expect(res.stderr).toMatch(/Unknown command/);
  });

  it('resolve on missing TXT record exits NOHOST (68)', () => {
    // .test is reserved by RFC 2606 and should never resolve. Using a
    // long random-ish label so a cache-poisoned resolver can't hijack.
    const res = run(['resolve', 'nonexistent-tld-99999-' + Date.now() + '.test']);
    expect(res.code).toBe(68);
  });

  it('validate on missing file exits NOINPUT (66)', () => {
    const missing = path.join(os.tmpdir(), `agentroot-test-missing-${Date.now()}.json`);
    const res = run(['validate', missing]);
    expect(res.code).toBe(66);
  });

  it('validate on malformed JSON exits PROTOCOL (76)', () => {
    const tmp = path.join(os.tmpdir(), `agentroot-test-bad-${Date.now()}.json`);
    fs.writeFileSync(tmp, '{ not valid json');
    try {
      const res = run(['validate', tmp]);
      expect(res.code).toBe(76);
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it('validate on well-formed JSON that fails schema exits PROTOCOL (76)', () => {
    const tmp = path.join(os.tmpdir(), `agentroot-test-empty-${Date.now()}.json`);
    fs.writeFileSync(tmp, '{}');
    try {
      const res = run(['validate', tmp]);
      expect(res.code).toBe(76);
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it('--json error path emits JSON envelope on stdout with correct code', () => {
    const res = run(['resolve', 'nonexistent-tld-99999.test', '--json']);
    expect(res.code).toBe(68);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.error.code).toBe('NOHOST');
    expect(typeof parsed.error.message).toBe('string');
  });

  it('resolve --help prints command-specific page', () => {
    const res = run(['resolve', '--help']);
    expect(res.code).toBe(0);
    expect(res.stdout).toMatch(/agentroot resolve/);
    expect(res.stdout).toMatch(/EXIT CODES/);
  });

  it('search --help prints command-specific page', () => {
    const res = run(['search', '--help']);
    expect(res.code).toBe(0);
    expect(res.stdout).toMatch(/agentroot search/);
  });

  it('--help with no command prints global help', () => {
    const res = run(['--help']);
    expect(res.code).toBe(0);
    expect(res.stdout).toMatch(/CLI for the AgentRoot protocol/);
  });

  it('help (subcommand) prints global help', () => {
    const res = run(['help']);
    expect(res.code).toBe(0);
    expect(res.stdout).toMatch(/CLI for the AgentRoot protocol/);
  });
});
