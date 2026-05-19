import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test only installMcp + installAgent (pure-orchestration over a record)
// directly; the full cmdInstall dispatcher does DNS+registry IO and is
// covered by the integration smoke tests.

import { installMcp, installAgent, type JsonOut } from '../../src/commands/install';
import { setColorsDisabledForTest } from '../../src/cli/colors';

function newJsonOut(): JsonOut {
  return { status: 'success', domain: '', recordId: '', type: null, installed: [], skipped: [], errors: [] };
}

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  setColorsDisabledForTest(true);
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  logSpy.mockRestore();
  errSpy.mockRestore();
});

describe('installMcp', () => {
  it('builds the stdio config when transport=stdio + install present', () => {
    const out = newJsonOut();
    installMcp('x.com', 'my-mcp', {
      name: 'My MCP',
      transport: 'stdio',
      install: { command: 'npx @scope/pkg' },
    }, { json: true }, out);
    expect(out.type).toBe('mcp');
    const entry = out.installed[0] as Record<string, unknown>;
    const config = entry['config'] as Record<string, Record<string, unknown>>;
    expect(config['x.com/my-mcp']).toEqual({ command: 'npx', args: ['@scope/pkg'] });
  });

  it('builds a url config for non-stdio transports', () => {
    const out = newJsonOut();
    installMcp('x.com', 'my-mcp', {
      name: 'My MCP',
      transport: 'sse',
      endpoint: 'https://x/mcp',
    }, { json: true }, out);
    const entry = out.installed[0] as Record<string, unknown>;
    expect(entry['config']).toEqual({ 'x.com/my-mcp': { url: 'https://x/mcp' } });
  });

  it('defaults transport to sse', () => {
    const out = newJsonOut();
    installMcp('x.com', 'my-mcp', { endpoint: 'https://x/mcp' }, { json: true }, out);
    const entry = out.installed[0] as Record<string, unknown>;
    expect(entry['transport']).toBe('sse');
  });

  it('produces no config when neither stdio+install nor endpoint is given', () => {
    const out = newJsonOut();
    installMcp('x.com', 'my-mcp', {}, { json: true }, out);
    const entry = out.installed[0] as Record<string, unknown>;
    expect(entry['config']).toBeNull();
  });

  it('renders human output and prints tools array', () => {
    const out = newJsonOut();
    installMcp('x.com', 'my-mcp', {
      name: 'My MCP',
      description: 'desc',
      tools: [{ name: 'search', description: 'find stuff' }, { name: 'fetch' }],
      transport: 'sse',
      endpoint: 'https://x/mcp',
    }, {}, out);
    const joined = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(joined).toMatch(/My MCP/);
    expect(joined).toMatch(/search/);
    expect(joined).toMatch(/fetch/);
  });

  it('renders auth warning when auth != "none"', () => {
    const out = newJsonOut();
    installMcp('x.com', 'my-mcp', {
      name: 'M',
      transport: 'sse',
      endpoint: 'https://x/mcp',
      auth: 'apikey',
      docs: 'https://x/docs',
    }, {}, out);
    const stderr = errSpy.mock.calls.map(c => c[0]).join('\n');
    expect(stderr).toMatch(/auth/);
    expect(stderr).toMatch(/apikey/);
    expect(stderr).toMatch(/docs/);
  });

  it('returns early under --json without printing', () => {
    const out = newJsonOut();
    installMcp('x.com', 'my-mcp', {
      name: 'M', transport: 'sse', endpoint: 'https://x/mcp',
    }, { json: true }, out);
    expect(logSpy).not.toHaveBeenCalled();
  });
});

describe('installAgent', () => {
  it('captures agent metadata in jsonOut', () => {
    const out = newJsonOut();
    installAgent('x.com', 'my-agent', {
      type: 'agent', name: 'My Agent', endpoint: 'https://x/agent',
      protocol: 'a2a', capabilities: ['search'], auth: 'none',
    }, { json: true }, out);
    expect(out.type).toBe('agent');
    const entry = out.installed[0] as Record<string, unknown>;
    expect(entry['name']).toBe('My Agent');
    expect(entry['endpoint']).toBe('https://x/agent');
    expect(entry['protocol']).toBe('a2a');
    expect(entry['capabilities']).toEqual(['search']);
  });

  it('defaults protocol to a2a', () => {
    const out = newJsonOut();
    installAgent('x.com', 'a', { type: 'agent' }, { json: true }, out);
    const entry = out.installed[0] as Record<string, unknown>;
    expect(entry['protocol']).toBe('a2a');
  });

  it('renders human output with endpoint, protocol, caps', () => {
    const out = newJsonOut();
    installAgent('x.com', 'a', {
      type: 'agent', name: 'A', endpoint: 'https://x/a',
      capabilities: ['search', 'summarize'], protocol: 'a2a',
      docs: 'https://x/docs',
    }, {}, out);
    const joined = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(joined).toMatch(/A/);
    expect(joined).toMatch(/https:\/\/x\/a/);
    expect(joined).toMatch(/search, summarize/);
    expect(joined).toMatch(/docs/);
  });

  it('returns early under --json without printing', () => {
    const out = newJsonOut();
    installAgent('x.com', 'a', { type: 'agent' }, { json: true }, out);
    expect(logSpy).not.toHaveBeenCalled();
  });
});
