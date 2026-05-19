import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fatal, configureJsonMode, setJsonModeForTest, isJsonMode } from '../../src/cli/fatal';
import { EXIT } from '../../src/cli/exit-codes';
import { setColorsDisabledForTest } from '../../src/cli/colors';

describe('fatal()', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setColorsDisabledForTest(true);
    setJsonModeForTest(false);
    // process.exit throws so the `never`-returning fatal() can be tested.
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('__exit__');
    }) as never);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    stdoutSpy.mockRestore();
    errSpy.mockRestore();
    setJsonModeForTest(false);
  });

  it('exits 1 (GENERIC) by default', () => {
    expect(() => fatal('boom')).toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.GENERIC);
  });

  it('prints "error <msg>" to stderr in human mode', () => {
    expect(() => fatal('boom')).toThrow('__exit__');
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('boom'));
  });

  it('prints the hint line on stderr when given a string hint', () => {
    expect(() => fatal('boom', 'try X')).toThrow('__exit__');
    const errorCalls = errSpy.mock.calls.flat().join(' ');
    expect(errorCalls).toContain('try X');
  });

  it('uses the numeric overload as exit code, no hint', () => {
    expect(() => fatal('boom', EXIT.NOHOST)).toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.NOHOST);
  });

  it('uses the third argument for exit code when both hint+code are given', () => {
    expect(() => fatal('boom', 'try X', EXIT.PROTOCOL)).toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.PROTOCOL);
  });

  it('emits a JSON envelope on stdout when jsonMode is on', () => {
    setJsonModeForTest(true);
    expect(() => fatal('boom', 'hint-text', EXIT.NOHOST)).toThrow('__exit__');
    expect(errSpy).not.toHaveBeenCalled();
    // stdout.write fired once with the envelope JSON + newline.
    expect(stdoutSpy).toHaveBeenCalled();
    const payload = (stdoutSpy.mock.calls[0]?.[0] ?? '') as string;
    const parsed = JSON.parse(payload.trim());
    expect(parsed).toEqual({ error: { code: 'NOHOST', message: 'boom', hint: 'hint-text' } });
  });

  it('omits hint key from the JSON envelope when no hint was provided', () => {
    setJsonModeForTest(true);
    expect(() => fatal('boom', EXIT.PROTOCOL)).toThrow('__exit__');
    const payload = (stdoutSpy.mock.calls[0]?.[0] ?? '') as string;
    const parsed = JSON.parse(payload.trim());
    expect(parsed.error.hint).toBeUndefined();
    expect(parsed.error.code).toBe('PROTOCOL');
  });
});

describe('json mode helpers', () => {
  afterEach(() => {
    setJsonModeForTest(false);
  });

  it('configureJsonMode({}) keeps json off', () => {
    configureJsonMode({});
    expect(isJsonMode()).toBe(false);
  });

  it('configureJsonMode({ json: true }) enables json', () => {
    configureJsonMode({ json: true });
    expect(isJsonMode()).toBe(true);
  });

  it('configureJsonMode() with no args is safe (defaults to {})', () => {
    configureJsonMode();
    expect(isJsonMode()).toBe(false);
  });

  it('setJsonModeForTest flips the flag directly', () => {
    setJsonModeForTest(true);
    expect(isJsonMode()).toBe(true);
    setJsonModeForTest(false);
    expect(isJsonMode()).toBe(false);
  });
});
