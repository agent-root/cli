import { describe, it, expect, beforeEach } from 'vitest';
import { formatRecord } from '../../src/utils/format-record';
import { setColorsDisabledForTest } from '../../src/cli/colors';

// Disable color for stable string comparison.
beforeEach(() => {
  setColorsDisabledForTest(true);
});

describe('formatRecord', () => {
  it('renders a minimal record with name, type, address', () => {
    const out = formatRecord({ id: 'my-skill', type: 'skill', _domain: 'example.com' });
    expect(out).toContain('my-skill');
    expect(out).toContain('(Skill)');
    expect(out).toContain('address:');
    expect(out).toContain('example.com/my-skill');
  });

  it('prefers name over id for the header', () => {
    const out = formatRecord({ id: 'r1', name: 'My Skill', type: 'skill', _domain: 'x.com' });
    expect(out).toContain('My Skill');
  });

  it('uses raw type when the type label is unknown', () => {
    const out = formatRecord({ id: 'r', type: 'custom-thing', _domain: 'x.com' });
    expect(out).toContain('(custom-thing)');
  });

  it('renders description, endpoint, transport, protocol, auth, pricing fields', () => {
    const out = formatRecord({
      id: 'r',
      type: 'mcp',
      _domain: 'x.com',
      description: 'desc-here',
      endpoint: 'https://x/mcp',
      transport: 'sse',
      protocol: 'mcp',
      auth: 'apikey',
      pricing: 'free',
    });
    expect(out).toContain('desc-here');
    expect(out).toContain('https://x/mcp');
    expect(out).toContain('sse');
    expect(out).toContain('mcp');
    expect(out).toContain('apikey');
    expect(out).toContain('free');
  });

  it('renders index and skill_md fields', () => {
    const out = formatRecord({
      id: 'r',
      type: 'skill',
      _domain: 'x.com',
      index: 'https://x/index.json',
      skill_md: 'https://x/SKILL.md',
    });
    expect(out).toContain('index:');
    expect(out).toContain('https://x/index.json');
    expect(out).toContain('skill_md:');
    expect(out).toContain('https://x/SKILL.md');
  });

  it('renders capabilities array joined by comma', () => {
    const out = formatRecord({
      id: 'r',
      type: 'agent',
      _domain: 'x.com',
      capabilities: ['search', 'summarize'],
    });
    expect(out).toContain('caps:');
    expect(out).toContain('search, summarize');
  });

  it('renders tools array as comma-joined names', () => {
    const out = formatRecord({
      id: 'r',
      type: 'mcp',
      _domain: 'x.com',
      tools: [{ name: 'tool-a' }, { name: 'tool-b' }],
    });
    expect(out).toContain('tools:');
    expect(out).toContain('tool-a, tool-b');
  });

  it('omits caps line when capabilities array is empty', () => {
    const out = formatRecord({ id: 'r', type: 'agent', _domain: 'x.com', capabilities: [] });
    expect(out).not.toContain('caps:');
  });

  it('omits tools line when tools array is empty', () => {
    const out = formatRecord({ id: 'r', type: 'mcp', _domain: 'x.com', tools: [] });
    expect(out).not.toContain('tools:');
  });

  it('honors custom indent', () => {
    const out = formatRecord({ id: 'r', type: 'skill', _domain: 'x.com' }, '    ');
    // First line starts with the 4-space indent.
    expect(out.split('\n')[0]!.startsWith('    ')).toBe(true);
  });

  it('uses default 2-space indent when no indent given', () => {
    const out = formatRecord({ id: 'r', type: 'skill', _domain: 'x.com' });
    expect(out.split('\n')[0]!.startsWith('  ')).toBe(true);
  });

  it('does not crash when _domain is missing', () => {
    const out = formatRecord({ id: 'r', type: 'skill' });
    expect(out).toContain('/r'); // _domain || '' → '/r'
  });

  it('does not render a caps line when capabilities is not an array', () => {
    const out = formatRecord({ id: 'r', type: 'skill', _domain: 'x.com', capabilities: 'search,summarize' as unknown as string[] });
    expect(out).not.toContain('caps:');
  });
});
