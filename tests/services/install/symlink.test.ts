import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs', () => {
  const mkdirSync = vi.fn();
  const lstatSync = vi.fn();
  const rmSync = vi.fn();
  const symlinkSync = vi.fn();
  const cpSync = vi.fn();
  return {
    default: { mkdirSync, lstatSync, rmSync, symlinkSync, cpSync },
    mkdirSync, lstatSync, rmSync, symlinkSync, cpSync,
  };
});

import fs from 'node:fs';
import { ensureCanonicalStore, createSymlink } from '../../../src/services/install/symlink';

beforeEach(() => {
  vi.mocked(fs.mkdirSync).mockReset();
  vi.mocked(fs.lstatSync).mockReset();
  vi.mocked(fs.rmSync).mockReset();
  vi.mocked(fs.symlinkSync).mockReset();
  vi.mocked(fs.cpSync).mockReset();
});

describe('ensureCanonicalStore', () => {
  it('mkdirs the canonical ~/.agents/skills/<domain>/<recordId> dir', () => {
    const out = ensureCanonicalStore('example.com', 'my-skill');
    expect(out).toContain('.agents');
    expect(out).toContain('skills');
    expect(out).toContain('example.com');
    expect(out).toContain('my-skill');
    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('my-skill'), { recursive: true });
  });
});

describe('createSymlink', () => {
  const originalPlatform = process.platform;

  it('creates a symlink on non-windows and returns "symlink"', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    // lstat throws ENOENT — no existing entry to clean up.
    vi.mocked(fs.lstatSync).mockImplementation(() => { throw new Error('ENOENT'); });
    const out = createSymlink('/canonical/path', '/link/path');
    expect(out).toBe('symlink');
    expect(fs.symlinkSync).toHaveBeenCalledWith(expect.stringContaining('/canonical/path'), '/link/path');
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  it('cleans up an existing symlink before recreating', () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    vi.mocked(fs.lstatSync).mockReturnValue({
      isSymbolicLink: () => true,
      isDirectory: () => false,
    } as unknown as ReturnType<typeof fs.lstatSync>);
    createSymlink('/canonical/path', '/link/path');
    expect(fs.rmSync).toHaveBeenCalledWith('/link/path', { recursive: true });
    expect(fs.symlinkSync).toHaveBeenCalled();
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  it('cleans up an existing directory (e.g. user-created folder)', () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    vi.mocked(fs.lstatSync).mockReturnValue({
      isSymbolicLink: () => false,
      isDirectory: () => true,
    } as unknown as ReturnType<typeof fs.lstatSync>);
    createSymlink('/canonical/path', '/link/path');
    expect(fs.rmSync).toHaveBeenCalled();
    expect(fs.symlinkSync).toHaveBeenCalled();
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  it('creates the parent dir for the link', () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    vi.mocked(fs.lstatSync).mockImplementation(() => { throw new Error('ENOENT'); });
    createSymlink('/canonical/path', '/parent/link');
    expect(fs.mkdirSync).toHaveBeenCalledWith('/parent', { recursive: true });
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  it('on win32 tries junction symlink then falls back to cpSync copy on failure', () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    vi.mocked(fs.lstatSync).mockImplementation(() => { throw new Error('ENOENT'); });
    vi.mocked(fs.symlinkSync).mockImplementation(() => { throw new Error('EPERM'); });
    const out = createSymlink('/canonical/path', '/link/path');
    expect(out).toBe('copy');
    expect(fs.cpSync).toHaveBeenCalledWith('/canonical/path', '/link/path', { recursive: true });
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  it('on win32 returns "junction" when symlink succeeds', () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    vi.mocked(fs.lstatSync).mockImplementation(() => { throw new Error('ENOENT'); });
    vi.mocked(fs.symlinkSync).mockImplementation(() => undefined);
    const out = createSymlink('/canonical/path', '/link/path');
    expect(out).toBe('junction');
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });
});
