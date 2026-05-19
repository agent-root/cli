import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('node:fs', () => {
  const existsSync = vi.fn();
  const readFileSync = vi.fn();
  return {
    default: { existsSync, readFileSync },
    existsSync, readFileSync,
  };
});

vi.mock('@agent-root/core', async () => {
  const actual = await vi.importActual<typeof import('@agent-root/core')>('@agent-root/core');
  return {
    ...actual,
    validateManifest: vi.fn(),
  };
});

import fs from 'node:fs';
import * as core from '@agent-root/core';
import { cmdValidate } from '../../src/commands/validate';
import { setJsonModeForTest } from '../../src/cli/fatal';
import { EXIT } from '../../src/cli/exit-codes';

let exitSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.mocked(fs.existsSync).mockReset();
  vi.mocked(fs.readFileSync).mockReset();
  vi.mocked(core.validateManifest).mockReset();
  setJsonModeForTest(false);
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('__exit__');
  }) as never);
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  exitSpy.mockRestore();
  logSpy.mockRestore();
  errSpy.mockRestore();
});

describe('cmdValidate', () => {
  it('fatals NOINPUT when the file does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    await expect(cmdValidate(['/tmp/missing.json'], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.NOINPUT);
  });

  it('fatals PROTOCOL on malformed JSON', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{not json');
    await expect(cmdValidate(['/tmp/bad.json'], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.PROTOCOL);
  });

  it('fatals NOPERM on EACCES', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      const err = new Error('perm denied') as NodeJS.ErrnoException;
      err.code = 'EACCES';
      throw err;
    });
    await expect(cmdValidate(['/tmp/x.json'], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.NOPERM);
  });

  it('fatals NOINPUT on other read errors', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      const err = new Error('io') as NodeJS.ErrnoException;
      err.code = 'EIO';
      throw err;
    });
    await expect(cmdValidate(['/tmp/x.json'], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.NOINPUT);
  });

  it('fatals PROTOCOL when validateManifest reports invalid', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{}');
    vi.mocked(core.validateManifest).mockReturnValue({ valid: false, errors: ['missing domain'] });
    await expect(cmdValidate(['/tmp/x.json'], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.PROTOCOL);
  });

  it('happy path: renders summary for a valid manifest', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      domain: 'x.com',
      records: [
        { type: 'mcp', id: 'a' },
        { type: 'skill', id: 'b' },
        { type: 'skill', id: 'c' },
      ],
    }));
    vi.mocked(core.validateManifest).mockReturnValue({ valid: true, errors: [] });
    await cmdValidate(['/tmp/x.json'], {});
    const joined = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(joined).toMatch(/valid/);
    expect(joined).toMatch(/x\.com/);
    expect(joined).toMatch(/records: 3/);
  });

  it('renders subdomains when present', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      domain: 'x.com',
      records: [],
      subdomains: ['a', 'b'],
    }));
    vi.mocked(core.validateManifest).mockReturnValue({ valid: true, errors: [] });
    await cmdValidate(['/tmp/x.json'], {});
    const joined = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(joined).toMatch(/subdomains: a, b/);
  });

  it('--json emits the valid envelope', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ domain: 'x.com', records: [] }));
    vi.mocked(core.validateManifest).mockReturnValue({ valid: true, errors: [] });
    await cmdValidate(['/tmp/x.json'], { json: true });
    const out = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    expect(out.valid).toBe(true);
    expect(out.file).toBe('/tmp/x.json');
    expect(out.manifest.domain).toBe('x.com');
  });
});
