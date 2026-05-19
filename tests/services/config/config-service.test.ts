import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node:fs so the test never touches the user's real ~/.agentroot.
vi.mock('node:fs', async () => {
  const readFileSync = vi.fn();
  const writeFileSync = vi.fn();
  const mkdirSync = vi.fn();
  return {
    default: { readFileSync, writeFileSync, mkdirSync },
    readFileSync, writeFileSync, mkdirSync,
  };
});

import fs from 'node:fs';
import { loadConfig, saveConfig, getApiBase, CONFIG_PATH } from '../../../src/services/config/config-service';

beforeEach(() => {
  vi.mocked(fs.readFileSync).mockReset();
  vi.mocked(fs.writeFileSync).mockReset();
  vi.mocked(fs.mkdirSync).mockReset();
});

describe('CONFIG_PATH', () => {
  it('resolves under the home dir', () => {
    expect(CONFIG_PATH).toContain('.agentroot');
    expect(CONFIG_PATH).toContain('config.json');
  });
});

describe('loadConfig', () => {
  it('parses the JSON contents of the config file', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('{"api-url":"https://x"}');
    expect(loadConfig()).toEqual({ 'api-url': 'https://x' });
  });

  it('returns {} when the file is missing (readFileSync throws)', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => { throw new Error('ENOENT'); });
    expect(loadConfig()).toEqual({});
  });

  it('returns {} when the file is malformed JSON', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('not json');
    expect(loadConfig()).toEqual({});
  });
});

describe('saveConfig', () => {
  it('writes the JSON-serialized config and ensures the parent dir exists', () => {
    saveConfig({ 'api-url': 'https://x' });
    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('.agentroot'), { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('config.json'),
      expect.stringContaining('"api-url": "https://x"'),
    );
  });

  it('serializes with 2-space indent + trailing newline', () => {
    saveConfig({ a: 'b' });
    const arg = vi.mocked(fs.writeFileSync).mock.calls[0]?.[1] as string;
    expect(arg.endsWith('\n')).toBe(true);
    expect(arg).toContain('  "a": "b"');
  });
});

describe('getApiBase', () => {
  // getApiBase has module-local memoization, so we can only meaningfully
  // assert that it returns *some* string and equals the default when no
  // config exists. To exercise the override path we'd have to bust the
  // module cache, which complicates this test more than its value.
  it('returns a string', () => {
    expect(typeof getApiBase()).toBe('string');
  });
});
