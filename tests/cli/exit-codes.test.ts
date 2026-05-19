import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EXIT, exitCodeName } from '../../src/cli/exit-codes';
import { fatal, setJsonModeForTest } from '../../src/cli/fatal';

describe('exit-codes', () => {
  describe('EXIT constants', () => {
    it('matches sysexits-style values', () => {
      // Spot-check the codes we promise in README + per-command help so
      // an accidental renumber breaks the build, not real users.
      expect(EXIT.OK).toBe(0);
      expect(EXIT.GENERIC).toBe(1);
      expect(EXIT.USAGE).toBe(2);
      expect(EXIT.NOINPUT).toBe(66);
      expect(EXIT.NOHOST).toBe(68);
      expect(EXIT.UNAVAILABLE).toBe(69);
      expect(EXIT.PROTOCOL).toBe(76);
      expect(EXIT.NOPERM).toBe(77);
      expect(EXIT.CONFIG).toBe(78);
    });
  });

  describe('exitCodeName', () => {
    it('maps numeric codes back to symbolic names', () => {
      expect(exitCodeName(0)).toBe('OK');
      expect(exitCodeName(1)).toBe('GENERIC');
      expect(exitCodeName(2)).toBe('USAGE');
      expect(exitCodeName(66)).toBe('NOINPUT');
      expect(exitCodeName(68)).toBe('NOHOST');
      expect(exitCodeName(69)).toBe('UNAVAILABLE');
      expect(exitCodeName(76)).toBe('PROTOCOL');
      expect(exitCodeName(77)).toBe('NOPERM');
      expect(exitCodeName(78)).toBe('CONFIG');
    });

    it('returns GENERIC for unknown codes', () => {
      // Real-world: some Node errors bubble through with their own errno
      // values (e.g. ETIMEDOUT = 110 on Linux). We don't want the JSON
      // envelope to ever contain a stringified number.
      expect(exitCodeName(110)).toBe('GENERIC');
      expect(exitCodeName(255)).toBe('GENERIC');
      expect(exitCodeName(-1)).toBe('GENERIC');
    });
  });
});

describe('fatal()', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // `fatal` calls process.exit, which would terminate the test runner.
    // Throw instead so the test can catch and assert on the exit code.
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`__exit:${code}`);
    }) as never);
    stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    setJsonModeForTest(false);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
    setJsonModeForTest(false);
  });

  it('defaults to GENERIC (1) when no code is passed', () => {
    expect(() => fatal('boom')).toThrow('__exit:1');
  });

  it('treats 2nd-arg string as hint, exits GENERIC', () => {
    expect(() => fatal('boom', 'try again')).toThrow('__exit:1');
    expect(stderrSpy).toHaveBeenCalledTimes(2);
  });

  it('treats 2nd-arg number as exit code', () => {
    expect(() => fatal('boom', EXIT.NOHOST)).toThrow('__exit:68');
  });

  it('accepts hint + code together', () => {
    expect(() => fatal('boom', 'try this', EXIT.UNAVAILABLE)).toThrow('__exit:69');
  });

  it('in JSON mode writes error envelope to stdout', () => {
    setJsonModeForTest(true);
    expect(() => fatal('boom', 'helpful hint', EXIT.NOHOST)).toThrow('__exit:68');

    // Find the stdout call that contains the JSON envelope.
    const written = stdoutSpy.mock.calls.map(c => c[0]).join('');
    expect(written).toContain('"code": "NOHOST"');
    expect(written).toContain('"message": "boom"');
    expect(written).toContain('"hint": "helpful hint"');
    // And in JSON mode we deliberately do NOT print to stderr.
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('omits hint from envelope when none was provided', () => {
    setJsonModeForTest(true);
    expect(() => fatal('boom', EXIT.PROTOCOL)).toThrow('__exit:76');
    const written = stdoutSpy.mock.calls.map(c => c[0]).join('');
    expect(written).toContain('"code": "PROTOCOL"');
    expect(written).not.toContain('"hint"');
  });
});
