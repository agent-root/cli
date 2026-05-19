import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @agent-root/core so we can intercept upsertInstalled + resolveToolDir
// without touching the real filesystem.
vi.mock('@agent-root/core', async () => {
  const actual = await vi.importActual<typeof import('@agent-root/core')>('@agent-root/core');
  return {
    ...actual,
    resolveToolDir: vi.fn((tool: string, isProject: boolean) => `/home/.agents/${tool}${isProject ? '-proj' : ''}`),
    upsertInstalled: vi.fn(),
  };
});

import * as core from '@agent-root/core';
import { updateGlobalManifest } from '../../../src/services/install/update-global-manifest';

describe('updateGlobalManifest', () => {
  beforeEach(() => {
    vi.mocked(core.resolveToolDir).mockClear();
    vi.mocked(core.upsertInstalled).mockClear();
  });

  it('builds a tools map keyed by tool with path = baseDir/domain/recordId', () => {
    updateGlobalManifest({
      domain: 'example.com',
      recordId: 'my-skill',
      tools: ['claude', 'cursor'],
      linkTypes: { claude: 'symlink', cursor: 'copy' },
      skillMeta: { name: 'My Skill', versionHash: 'abc123', url: 'https://example.com/SKILL.md' },
    });

    const call = vi.mocked(core.upsertInstalled).mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(call!.domain).toBe('example.com');
    expect(call!.record_id).toBe('my-skill');
    expect(call!.type).toBe('skill');
    expect(call!.name).toBe('My Skill');
    expect(call!.source_url).toBe('https://example.com/SKILL.md');
    expect(call!.version_hash).toBe('abc123');
    expect(call!.tools).toEqual({
      claude: { path: '/home/.agents/claude/example.com/my-skill', link_type: 'symlink' },
      cursor: { path: '/home/.agents/cursor/example.com/my-skill', link_type: 'copy' },
    });
  });

  it('defaults link_type to symlink when not in linkTypes map', () => {
    updateGlobalManifest({
      domain: 'a.com',
      recordId: 'r',
      tools: ['claude'],
      linkTypes: {}, // empty: no entry for claude
      skillMeta: { name: 'X', versionHash: 'h', url: 'u' },
    });
    const call = vi.mocked(core.upsertInstalled).mock.calls[0]?.[0];
    expect(call!.tools['claude']!.link_type).toBe('symlink');
  });

  it('resolves tool dir with isProject=false (global mode)', () => {
    updateGlobalManifest({
      domain: 'a.com',
      recordId: 'r',
      tools: ['claude', 'codex'],
      linkTypes: {},
      skillMeta: { name: 'X', versionHash: 'h', url: 'u' },
    });
    // Each tool's resolveToolDir call gets `false` for isProject.
    const calls = vi.mocked(core.resolveToolDir).mock.calls;
    expect(calls).toEqual([['claude', false], ['codex', false]]);
  });

  it('handles an empty tools array', () => {
    updateGlobalManifest({
      domain: 'a.com',
      recordId: 'r',
      tools: [],
      linkTypes: {},
      skillMeta: { name: 'X', versionHash: 'h', url: 'u' },
    });
    const call = vi.mocked(core.upsertInstalled).mock.calls[0]?.[0];
    expect(call!.tools).toEqual({});
  });
});
