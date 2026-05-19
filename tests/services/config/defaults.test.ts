import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs', () => {
  const existsSync = vi.fn();
  const mkdirSync = vi.fn();
  const writeFileSync = vi.fn();
  return {
    default: { existsSync, mkdirSync, writeFileSync },
    existsSync, mkdirSync, writeFileSync,
  };
});

vi.mock('@agent-root/core', async () => {
  const actual = await vi.importActual<typeof import('@agent-root/core')>('@agent-root/core');
  return {
    ...actual,
    scanInstalled: vi.fn(() => []),
  };
});

vi.mock('../../../src/services/install/install-skill', () => ({
  installSkill: vi.fn().mockResolvedValue(undefined),
}));

import fs from 'node:fs';
import * as core from '@agent-root/core';
import { installSkill } from '../../../src/services/install/install-skill';
import { ensureDefaults } from '../../../src/services/config/defaults';

beforeEach(() => {
  vi.mocked(fs.existsSync).mockReset();
  vi.mocked(fs.mkdirSync).mockReset();
  vi.mocked(fs.writeFileSync).mockReset();
  vi.mocked(core.scanInstalled).mockReset();
  vi.mocked(installSkill).mockReset();
  vi.mocked(installSkill).mockResolvedValue(undefined);
});

describe('ensureDefaults', () => {
  it('skips entirely when the sentinel file exists', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    await ensureDefaults({});
    expect(core.scanInstalled).not.toHaveBeenCalled();
    expect(installSkill).not.toHaveBeenCalled();
  });

  it('marks installed (writes sentinel) when no default skills are missing', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    // scanInstalled reports secondary-sales is already there.
    vi.mocked(core.scanInstalled).mockReturnValue([
      { record_id: 'secondary-sales' } as unknown as ReturnType<typeof core.scanInstalled>[number],
    ]);
    await ensureDefaults({});
    expect(installSkill).not.toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('installs missing defaults and writes the sentinel', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(core.scanInstalled).mockReturnValue([]);
    await ensureDefaults({});
    expect(installSkill).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('swallows install errors without re-throwing (non-blocking)', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(core.scanInstalled).mockReturnValue([]);
    vi.mocked(installSkill).mockRejectedValueOnce(new Error('boom'));
    await expect(ensureDefaults({})).resolves.toBeUndefined();
  });

  it('passes flags + _quiet through to installSkill', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(core.scanInstalled).mockReturnValue([]);
    await ensureDefaults({ json: true });
    const call = vi.mocked(installSkill).mock.calls[0]?.[0];
    expect(call!.flags['_quiet']).toBe(true);
    expect(call!.flags['json']).toBe(true);
  });

  it('passes domain + recordId derived from DEFAULT_SKILLS', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(core.scanInstalled).mockReturnValue([]);
    await ensureDefaults({});
    const call = vi.mocked(installSkill).mock.calls[0]?.[0];
    expect(call!.domain).toBe('doma.xyz');
    expect(call!.recordId).toBe('secondary-sales');
  });
});
