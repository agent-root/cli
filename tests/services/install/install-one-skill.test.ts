import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/services/http/fetch', () => ({
  fetch: vi.fn(),
}));

vi.mock('../../../src/services/install/symlink', () => ({
  ensureCanonicalStore: vi.fn(() => '/canonical/dir'),
  createSymlink: vi.fn(() => 'symlink'),
}));

vi.mock('../../../src/services/install/update-global-manifest', () => ({
  updateGlobalManifest: vi.fn(),
}));

vi.mock('@agent-root/core', async () => {
  const actual = await vi.importActual<typeof import('@agent-root/core')>('@agent-root/core');
  return {
    ...actual,
    resolveToolDir: vi.fn((tool: string) => `/home/.agents/${tool}`),
    hashContent: vi.fn(() => 'fake-hash'),
    writeSkill: vi.fn(),
    parseSupportingFiles: vi.fn(() => []),
  };
});

import * as core from '@agent-root/core';
import { fetch } from '../../../src/services/http/fetch';
import { createSymlink } from '../../../src/services/install/symlink';
import { updateGlobalManifest } from '../../../src/services/install/update-global-manifest';
import { installOneSkill } from '../../../src/services/install/install-one-skill';
import type { JsonOut, SkillMeta } from '../../../src/types/install';

function newJsonOut(): JsonOut {
  return { status: 'success', domain: '', recordId: '', type: null, installed: [], skipped: [], errors: [] };
}

function newSkill(overrides: Partial<SkillMeta> = {}): SkillMeta {
  return {
    id: 'my-skill',
    name: 'My Skill',
    description: 'desc',
    url: 'https://x.com/SKILL.md',
    domain: 'x.com',
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(fetch).mockReset();
  vi.mocked(createSymlink).mockReset();
  vi.mocked(createSymlink).mockReturnValue('symlink');
  vi.mocked(updateGlobalManifest).mockReset();
  vi.mocked(core.resolveToolDir).mockReset();
  vi.mocked(core.resolveToolDir).mockImplementation(((tool: string) => `/home/.agents/${tool}`) as never);
  vi.mocked(core.hashContent).mockReset();
  vi.mocked(core.hashContent).mockReturnValue('fake-hash');
  vi.mocked(core.writeSkill).mockReset();
  vi.mocked(core.parseSupportingFiles).mockReset();
  vi.mocked(core.parseSupportingFiles).mockReturnValue([]);
});

describe('installOneSkill', () => {
  it('skips and records when skill has no URL', async () => {
    const out = newJsonOut();
    const n = await installOneSkill(newSkill({ url: '' }), 'x.com', ['claude'], false, { json: true }, out);
    expect(n).toBe(0);
    expect(out.skipped).toHaveLength(1);
    expect(out.skipped[0]).toMatchObject({ id: 'my-skill', reason: 'no SKILL.md URL' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('records error and returns 0 when fetch fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('404'));
    const out = newJsonOut();
    const n = await installOneSkill(newSkill(), 'x.com', ['claude'], false, { json: true }, out);
    expect(n).toBe(0);
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0]).toMatchObject({ id: 'my-skill', error: '404' });
  });

  it('happy path: 0 supporting files, single tool, returns 1 installed', async () => {
    vi.mocked(fetch).mockResolvedValue('# SKILL.md\n');
    const out = newJsonOut();
    const n = await installOneSkill(newSkill(), 'x.com', ['claude'], false, { json: true }, out);
    expect(n).toBe(1);
    expect(out.installed).toHaveLength(1);
    expect(out.installed[0]!['tool']).toBe('claude');
    expect(out.installed[0]!['link_type']).toBe('symlink');
    expect(updateGlobalManifest).toHaveBeenCalledOnce();
  });

  it('installs N tools in one pass and returns N', async () => {
    vi.mocked(fetch).mockResolvedValue('# SKILL.md');
    const out = newJsonOut();
    const n = await installOneSkill(newSkill(), 'x.com', ['claude', 'cursor', 'codex'], false, { json: true }, out);
    expect(n).toBe(3);
    expect(out.installed).toHaveLength(3);
    expect(createSymlink).toHaveBeenCalledTimes(3);
  });

  it('fetches N supporting files in parallel', async () => {
    vi.mocked(core.parseSupportingFiles).mockReturnValue(['a.md', 'b.md', 'c.md']);
    vi.mocked(fetch).mockImplementation(async (url: string) => {
      if (url.endsWith('/SKILL.md')) return 'main';
      return `body-of-${url}`;
    });
    const out = newJsonOut();
    await installOneSkill(newSkill({ url: 'https://x.com/sub/SKILL.md' }), 'x.com', ['claude'], false, { json: true }, out);
    // 1 main fetch + 3 supporting fetches
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('skips supporting files that fail to fetch', async () => {
    vi.mocked(core.parseSupportingFiles).mockReturnValue(['a.md', 'b.md']);
    vi.mocked(fetch).mockImplementation(async (url: string) => {
      if (url.endsWith('/SKILL.md')) return 'main';
      if (url.endsWith('a.md')) return 'body-a';
      throw new Error('404');
    });
    const out = newJsonOut();
    const n = await installOneSkill(newSkill({ url: 'https://x.com/sub/SKILL.md' }), 'x.com', ['claude'], false, { json: true }, out);
    expect(n).toBe(1); // happy path still completes
    // writeSkill should be called for canonical + per tool
    expect(core.writeSkill).toHaveBeenCalled();
  });

  it('uses isProject=true to write per-tool copies (link_type=copy)', async () => {
    vi.mocked(fetch).mockResolvedValue('# SKILL.md');
    const out = newJsonOut();
    const n = await installOneSkill(newSkill(), 'x.com', ['claude'], true, { json: true }, out);
    expect(n).toBe(1);
    expect(out.installed[0]!['link_type']).toBe('copy');
    expect(createSymlink).not.toHaveBeenCalled();
  });

  it('falls back to fallbackDomain when skill.domain is missing', async () => {
    vi.mocked(fetch).mockResolvedValue('# SKILL.md');
    const out = newJsonOut();
    const skill = newSkill({ domain: '' });
    await installOneSkill(skill, 'fallback.com', ['claude'], false, { json: true }, out);
    const guard = vi.mocked(updateGlobalManifest).mock.calls[0]?.[0];
    expect(guard!.domain).toBe('fallback.com');
  });
});
