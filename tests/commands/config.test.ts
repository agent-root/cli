import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/services/config/config-service', () => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
  CONFIG_PATH: '/fake/path/config.json',
}));

import { loadConfig, saveConfig } from '../../src/services/config/config-service';
import { cmdConfig } from '../../src/commands/config';
import { setJsonModeForTest } from '../../src/cli/fatal';
import { EXIT } from '../../src/cli/exit-codes';

let exitSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.mocked(loadConfig).mockReset();
  vi.mocked(saveConfig).mockReset();
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

describe('cmdConfig get', () => {
  it('reports "No configuration" when config is empty', async () => {
    vi.mocked(loadConfig).mockReturnValue({});
    await cmdConfig(['get'], {});
    const joined = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(joined).toMatch(/No configuration set/);
    expect(joined).toMatch(/api-url/);
  });

  it('renders config keys when set', async () => {
    vi.mocked(loadConfig).mockReturnValue({ 'api-url': 'https://x', foo: 'bar' });
    await cmdConfig(['get'], {});
    const joined = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(joined).toMatch(/Current configuration/);
    expect(joined).toMatch(/api-url/);
    expect(joined).toMatch(/foo/);
  });

  it('runs the same path with no subcommand', async () => {
    vi.mocked(loadConfig).mockReturnValue({});
    await cmdConfig([], {});
    const joined = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(joined).toMatch(/No configuration set/);
  });
});

describe('cmdConfig set', () => {
  it('fatals USAGE when key or value is missing', async () => {
    await expect(cmdConfig(['set'], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.USAGE);
  });

  it('fatals USAGE when only key is provided', async () => {
    await expect(cmdConfig(['set', 'api-url'], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.USAGE);
  });

  it('persists the new key/value via saveConfig', async () => {
    vi.mocked(loadConfig).mockReturnValue({});
    await cmdConfig(['set', 'api-url', 'https://x.test'], {});
    expect(saveConfig).toHaveBeenCalledWith({ 'api-url': 'https://x.test' });
  });

  it('merges with existing config rather than overwriting', async () => {
    vi.mocked(loadConfig).mockReturnValue({ existing: 'value' });
    await cmdConfig(['set', 'new', 'val'], {});
    expect(saveConfig).toHaveBeenCalledWith({ existing: 'value', new: 'val' });
  });
});

describe('cmdConfig unknown', () => {
  it('fatals USAGE on an unknown subcommand', async () => {
    await expect(cmdConfig(['foo'], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.USAGE);
  });
});
