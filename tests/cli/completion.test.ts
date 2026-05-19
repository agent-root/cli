import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cmdCompletion, helpCompletion } from '../../src/commands/completion';

// These tests cover the four supported shells plus the unknown-shell
// error path. They avoid asserting on the full script content (that's a
// snapshot test problem we'd rather not maintain) — instead each shell
// is asserted to emit its distinguishing top-of-file marker, since that
// is what would break if a developer accidentally swapped two functions.

describe('cmdCompletion', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    // fatal() calls process.exit(); intercept so the test process keeps
    // running. We assert on the exit code instead.
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);
  });

  afterEach(() => {
    writeSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('emits bash completion with _agent_root function', () => {
    cmdCompletion(['bash'], {});
    const out = writeSpy.mock.calls.map(c => String(c[0])).join('');
    expect(out).toContain('_agent_root()');
    expect(out).toContain('complete -F _agent_root agent-root');
    expect(out).toContain('complete -F _agent_root agentroot');
  });

  it('emits zsh completion with #compdef directive', () => {
    cmdCompletion(['zsh'], {});
    const out = writeSpy.mock.calls.map(c => String(c[0])).join('');
    expect(out).toContain('#compdef agent-root agentroot');
    expect(out).toContain('_arguments');
    expect(out).toContain('compdef _agent-root');
  });

  it('emits fish completion with `complete -c agent-root` lines', () => {
    cmdCompletion(['fish'], {});
    const out = writeSpy.mock.calls.map(c => String(c[0])).join('');
    expect(out).toContain('complete -c agent-root');
    expect(out).toContain('__fish_use_subcommand');
  });

  it('emits PowerShell completion with Register-ArgumentCompleter', () => {
    cmdCompletion(['powershell'], {});
    const out = writeSpy.mock.calls.map(c => String(c[0])).join('');
    expect(out).toContain('Register-ArgumentCompleter');
    expect(out).toContain('agent-root,agentroot');
  });

  it('accepts pwsh as an alias for powershell', () => {
    cmdCompletion(['pwsh'], {});
    const out = writeSpy.mock.calls.map(c => String(c[0])).join('');
    expect(out).toContain('Register-ArgumentCompleter');
  });

  it('exits with USAGE (2) on missing shell argument', () => {
    expect(() => cmdCompletion([], {})).toThrow(/exit:2/);
  });

  it('exits with USAGE (2) on unknown shell', () => {
    expect(() => cmdCompletion(['tcsh'], {})).toThrow(/exit:2/);
  });
});

describe('helpCompletion', () => {
  it('prints the completion help page', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    helpCompletion();
    const out = logSpy.mock.calls.map(c => c[0]).join('\n');
    logSpy.mockRestore();
    expect(out).toContain('agentroot completion');
    expect(out).toMatch(/USAGE/);
    expect(out).toMatch(/EXAMPLES/);
    expect(out).toMatch(/EXIT CODES/);
    expect(out).toMatch(/bash/);
    expect(out).toMatch(/zsh/);
    expect(out).toMatch(/fish/);
  });
});
