import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('node:fs', () => {
  const existsSync = vi.fn();
  const mkdirSync = vi.fn();
  const writeFileSync = vi.fn();
  return {
    default: { existsSync, mkdirSync, writeFileSync },
    existsSync, mkdirSync, writeFileSync,
  };
});

import fs from 'node:fs';
import { cmdInit } from '../../src/commands/init';
import { setJsonModeForTest } from '../../src/cli/fatal';
import { EXIT } from '../../src/cli/exit-codes';

let exitSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.mocked(fs.existsSync).mockReset();
  vi.mocked(fs.mkdirSync).mockReset();
  vi.mocked(fs.writeFileSync).mockReset();
  setJsonModeForTest(false);
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('__exit__');
  }) as never);
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  exitSpy.mockRestore();
  logSpy.mockRestore();
});

describe('cmdInit', () => {
  it('fatals NOINPUT when the file exists and --force is not set', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    await expect(cmdInit(['/tmp/agentroot.json'], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.NOINPUT);
  });

  it('overwrites with --force', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    await cmdInit(['/tmp/agentroot.json'], { force: true });
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('writes a valid manifest template containing the domain', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    await cmdInit(['/tmp/agentroot.json'], { domain: 'mycompany.com' });
    const [_path, content] = vi.mocked(fs.writeFileSync).mock.calls[0]!;
    const parsed = JSON.parse(content as string);
    expect(parsed.domain).toBe('mycompany.com');
    expect(Array.isArray(parsed.records)).toBe(true);
    expect(parsed.records[0].type).toBe('mcp');
    expect(parsed.records[0].endpoint).toContain('mycompany.com');
  });

  it('defaults the domain to yourdomain.com', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    await cmdInit(['/tmp/agentroot.json'], {});
    const [_path, content] = vi.mocked(fs.writeFileSync).mock.calls[0]!;
    const parsed = JSON.parse(content as string);
    expect(parsed.domain).toBe('yourdomain.com');
  });

  it('ensures the parent dir is created', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    await cmdInit(['/nested/path/agentroot.json'], {});
    expect(fs.mkdirSync).toHaveBeenCalledWith('/nested/path', { recursive: true });
  });

  it('prints next-steps with the TXT record', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    await cmdInit(['/tmp/agentroot.json'], { domain: 'x.com' });
    const joined = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(joined).toMatch(/_agentroot\.x\.com/);
    expect(joined).toMatch(/v=ar1/);
    expect(joined).toMatch(/validate/);
  });
});
