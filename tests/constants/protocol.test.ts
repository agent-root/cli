import { describe, expect, it } from 'vitest'
import {
  PROTOCOL_VERSION,
  DNS_PREFIX,
  DOCS_URL,
  txtHostFor,
  buildTxtRecord,
} from '../../src/constants/protocol'

describe('protocol constants', () => {
  it('exposes the current protocol version tag', () => {
    expect(PROTOCOL_VERSION).toBe('v=ar1')
  })

  it('exposes the canonical DNS prefix', () => {
    expect(DNS_PREFIX).toBe('_agentroot')
  })

  it('exposes the public docs URL', () => {
    expect(DOCS_URL).toMatch(/^https:\/\/.*\/docs\/protocol$/)
  })
})

describe('txtHostFor', () => {
  it('prepends the DNS prefix with a dot', () => {
    expect(txtHostFor('example.com')).toBe('_agentroot.example.com')
  })

  it('handles subdomains', () => {
    expect(txtHostFor('foo.bar.example.com')).toBe('_agentroot.foo.bar.example.com')
  })

  it('handles unicode IDN-style domains literally', () => {
    expect(txtHostFor('xn--bcher-kva.example')).toBe('_agentroot.xn--bcher-kva.example')
  })
})

describe('buildTxtRecord', () => {
  it('produces the canonical v=ar1 manifest record', () => {
    expect(buildTxtRecord('example.com')).toBe(
      'v=ar1 manifest=https://example.com/.well-known/agentroot.json',
    )
  })

  it('starts with the protocol version (resolvers reject otherwise)', () => {
    expect(buildTxtRecord('example.com').startsWith(PROTOCOL_VERSION)).toBe(true)
  })

  it('uses HTTPS for the manifest URL', () => {
    expect(buildTxtRecord('example.com')).toContain('https://')
  })

  it('embeds the canonical .well-known manifest path', () => {
    expect(buildTxtRecord('example.com')).toContain('/.well-known/agentroot.json')
  })
})
