import { describe, expect, it } from 'vitest'
import { parseArgs } from '../../src/cli/parse-args'
import { formatRecord } from '../../src/utils/format-record'
import { RECORD_TYPES } from '../../src/constants/record-types'

describe('parseArgs', () => {
  it('returns undefined cmd for empty argv', () => {
    const r = parseArgs(['node', 'agentroot'])
    expect(r.cmd).toBeUndefined()
    expect(r.positional).toEqual([])
    expect(r.flags).toEqual({})
  })

  it('captures the command name', () => {
    const r = parseArgs(['node', 'agentroot', 'resolve'])
    expect(r.cmd).toBe('resolve')
  })

  it('captures positional args after the command', () => {
    const r = parseArgs(['node', 'agentroot', 'install', 'example.com/skill-1'])
    expect(r.cmd).toBe('install')
    expect(r.positional).toEqual(['example.com/skill-1'])
  })

  it('treats known boolean flags as true', () => {
    const r = parseArgs(['node', 'agentroot', 'install', 'x.com', '--all', '--project', '--json'])
    expect(r.flags['all']).toBe(true)
    expect(r.flags['project']).toBe(true)
    expect(r.flags['json']).toBe(true)
  })

  it('captures --key value pairs', () => {
    const r = parseArgs(['node', 'agentroot', 'install', 'x.com', '--tool', 'claude'])
    expect(r.flags['tool']).toBe('claude')
  })

  it('treats trailing flag without value as boolean true', () => {
    const r = parseArgs(['node', 'agentroot', 'config', '--foo'])
    expect(r.flags['foo']).toBe(true)
  })

  it('does not consume next arg as value when it looks like a flag', () => {
    const r = parseArgs(['node', 'agentroot', 'install', 'x.com', '--tool', '--json'])
    expect(r.flags['tool']).toBe(true)
    expect(r.flags['json']).toBe(true)
  })

  it('preserves multiple positionals', () => {
    const r = parseArgs(['node', 'agentroot', 'config', 'set', 'api-url', 'https://x.com'])
    expect(r.cmd).toBe('config')
    expect(r.positional).toEqual(['set', 'api-url', 'https://x.com'])
  })

  describe('short aliases', () => {
    it('treats -h as --help', () => {
      const r = parseArgs(['node', 'agentroot', '-h'])
      expect(r.flags['help']).toBe(true)
    })

    it('treats -v as --version', () => {
      const r = parseArgs(['node', 'agentroot', '-v'])
      expect(r.flags['version']).toBe(true)
    })

    it('treats -y, -f, -q, -j as their long forms', () => {
      const r = parseArgs(['node', 'agentroot', 'install', 'x.com/y', '-y', '-f', '-q', '-j'])
      expect(r.flags['yes']).toBe(true)
      expect(r.flags['force']).toBe(true)
      expect(r.flags['quiet']).toBe(true)
      expect(r.flags['json']).toBe(true)
    })

    it('treats multi-char single-dash tokens as positionals, not short flags', () => {
      const r = parseArgs(['node', 'agentroot', 'install', '-foo'])
      expect(r.positional).toEqual(['-foo'])
      expect(r.flags['foo']).toBeUndefined()
    })

    it('does not consume a short alias as the value of a preceding long flag', () => {
      const r = parseArgs(['node', 'agentroot', 'install', 'x.com', '--tool', '-j'])
      expect(r.flags['tool']).toBe(true)
      expect(r.flags['json']).toBe(true)
    })
  })

  describe('--key=value syntax', () => {
    it('parses --tool=claude equivalently to --tool claude', () => {
      const r = parseArgs(['node', 'agentroot', 'install', 'x.com', '--tool=claude'])
      expect(r.flags['tool']).toBe('claude')
    })

    it('supports values containing = signs', () => {
      const r = parseArgs(['node', 'agentroot', 'config', '--query=a=b'])
      expect(r.flags['query']).toBe('a=b')
    })

    it('parses --json=false as boolean false', () => {
      const r = parseArgs(['node', 'agentroot', 'search', 'x', '--json=false'])
      expect(r.flags['json']).toBe(false)
    })

    it('parses --json=true as boolean true', () => {
      const r = parseArgs(['node', 'agentroot', 'search', 'x', '--json=true'])
      expect(r.flags['json']).toBe(true)
    })
  })

  describe('-- end-of-options separator', () => {
    it('treats every token after -- as positional', () => {
      const r = parseArgs(['node', 'agentroot', 'resolve', '--', '--special', '-j'])
      expect(r.positional).toEqual(['--special', '-j'])
      expect(r.flags['special']).toBeUndefined()
      expect(r.flags['json']).toBeUndefined()
    })

    it('does not treat -- itself as a positional', () => {
      const r = parseArgs(['node', 'agentroot', 'resolve', '--', 'doma.xyz'])
      expect(r.positional).toEqual(['doma.xyz'])
    })

    it('still honors flags before --', () => {
      const r = parseArgs(['node', 'agentroot', 'resolve', '--json', '--', '--literal'])
      expect(r.flags['json']).toBe(true)
      expect(r.positional).toEqual(['--literal'])
    })
  })

  describe('--no-X negation', () => {
    it('preserves the literal --no-install as a positive flag', () => {
      const r = parseArgs(['node', 'agentroot', 'resolve', 'doma.xyz', '--no-install'])
      expect(r.flags['noInstall']).toBe(true)
    })

    it('treats --no-json as json=false', () => {
      const r = parseArgs(['node', 'agentroot', 'search', 'x', '--no-json'])
      expect(r.flags['json']).toBe(false)
    })

    it('treats --no-yes as yes=false', () => {
      const r = parseArgs(['node', 'agentroot', 'install', 'x.com/y', '--no-yes'])
      expect(r.flags['yes']).toBe(false)
    })
  })

  describe('kebab ≡ camelCase', () => {
    it('normalizes --no-install to noInstall', () => {
      const r = parseArgs(['node', 'agentroot', 'resolve', 'x.com', '--no-install'])
      expect(r.flags['noInstall']).toBe(true)
    })

    it('normalizes --manifest-url to manifestUrl', () => {
      const r = parseArgs(['node', 'agentroot', 'submit', 'x.com', '--manifest-url', 'https://x.com/m.json'])
      expect(r.flags['manifestUrl']).toBe('https://x.com/m.json')
    })

    it('accepts --noInstall and --manifestUrl camelCase forms', () => {
      const r = parseArgs(['node', 'agentroot', 'submit', 'x.com', '--noInstall', '--manifestUrl', 'https://x.com/m.json'])
      expect(r.flags['noInstall']).toBe(true)
      expect(r.flags['manifestUrl']).toBe('https://x.com/m.json')
    })

    it('normalizes snake_case as well', () => {
      const r = parseArgs(['node', 'agentroot', 'submit', 'x.com', '--manifest_url', 'https://x.com/m.json'])
      expect(r.flags['manifestUrl']).toBe('https://x.com/m.json')
    })
  })
})

describe('RECORD_TYPES', () => {
  it('maps known canonical record types to display labels', () => {
    expect(RECORD_TYPES['agent']).toBe('Agent')
    expect(RECORD_TYPES['mcp']).toBe('MCP Server')
    expect(RECORD_TYPES['skill']).toBe('Skill')
    expect(RECORD_TYPES['a2a']).toBe('A2A Endpoint')
    expect(RECORD_TYPES['payment']).toBe('Payment')
  })
})

describe('formatRecord', () => {
  const stripAnsi = (s: string) => s.replace(/\[[0-9;]*m/g, '')

  it('renders the record name and type label', () => {
    const out = stripAnsi(formatRecord({ id: 'x', name: 'My Skill', type: 'skill', _domain: 'a.io' }))
    expect(out).toContain('My Skill')
    expect(out).toContain('(Skill)')
  })

  it('falls back to id when name is missing', () => {
    const out = stripAnsi(formatRecord({ id: 'fallback-id', type: 'agent', _domain: 'a.io' }))
    expect(out).toContain('fallback-id')
    expect(out).toContain('(Agent)')
  })

  it('passes through unknown type strings verbatim', () => {
    const out = stripAnsi(formatRecord({ id: 'x', type: 'custom-type', _domain: 'a.io' }))
    expect(out).toContain('(custom-type)')
  })

  it('includes the address line', () => {
    const out = stripAnsi(formatRecord({ id: 'rec-1', type: 'skill', _domain: 'foo.com' }))
    expect(out).toContain('foo.com/rec-1')
  })

  it('omits optional fields when absent', () => {
    const out = stripAnsi(formatRecord({ id: 'x', name: 'X', type: 'skill', _domain: 'a.io' }))
    expect(out).not.toContain('desc:')
    expect(out).not.toContain('endpoint:')
    expect(out).not.toContain('caps:')
  })

  it('renders capabilities as a comma list', () => {
    const out = stripAnsi(formatRecord({
      id: 'x', name: 'X', type: 'skill', _domain: 'a.io',
      capabilities: ['cap-a', 'cap-b', 'cap-c'],
    }))
    expect(out).toContain('cap-a, cap-b, cap-c')
  })

  it('renders MCP tools as a comma list of names', () => {
    const out = stripAnsi(formatRecord({
      id: 'x', name: 'X', type: 'mcp', _domain: 'a.io',
      tools: [{ name: 'tool-1' }, { name: 'tool-2' }],
    }))
    expect(out).toContain('tool-1, tool-2')
  })

  it('renders description when present', () => {
    const out = stripAnsi(formatRecord({
      id: 'x', name: 'X', type: 'skill', _domain: 'a.io', description: 'A test skill',
    }))
    expect(out).toContain('A test skill')
  })

  it('respects the indent parameter', () => {
    const out = stripAnsi(formatRecord({ id: 'x', name: 'X', type: 'skill', _domain: 'a.io' }, '    '))
    expect(out.split('\n')[0]).toMatch(/^    X/)
  })
})
