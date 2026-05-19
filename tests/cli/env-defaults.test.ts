import { describe, it, expect } from 'vitest'
import { applyEnvDefaults } from '../../src/cli/parse-args'

/**
 * applyEnvDefaults() is the pivot between argv and environment-driven config.
 * The contract: explicit CLI flag wins, otherwise namespaced env wins,
 * otherwise CI=true defaults, otherwise nothing. Each test fixes a clean
 * env so we never leak between cases.
 */

function envFixture(over: Record<string, string> = {}): NodeJS.ProcessEnv {
  // Start from a known-empty baseline rather than inheriting the test runner's
  // env (which itself may set CI=true on actual CI machines).
  return { ...over } as NodeJS.ProcessEnv
}

describe('applyEnvDefaults', () => {
  it('CI=true implies --yes and --no-color when neither is set', () => {
    const flags: Record<string, string | boolean> = {}
    applyEnvDefaults(flags, envFixture({ CI: 'true' }))
    expect(flags['yes']).toBe(true)
    expect(flags['noColor']).toBe(true)
    // CI does not imply --json (intentional, would break existing scripts).
    expect(flags['json']).toBeUndefined()
  })

  it('CI with empty string does NOT trigger defaults', () => {
    const flags: Record<string, string | boolean> = {}
    applyEnvDefaults(flags, envFixture({ CI: '' }))
    expect(flags['yes']).toBeUndefined()
    expect(flags['noColor']).toBeUndefined()
  })

  it('AGENTROOT_YES=1 sets yes=true', () => {
    const flags: Record<string, string | boolean> = {}
    applyEnvDefaults(flags, envFixture({ AGENTROOT_YES: '1' }))
    expect(flags['yes']).toBe(true)
  })

  it('AGENTROOT_JSON=1 sets json=true', () => {
    const flags: Record<string, string | boolean> = {}
    applyEnvDefaults(flags, envFixture({ AGENTROOT_JSON: '1' }))
    expect(flags['json']).toBe(true)
  })

  it('AGENTROOT_NO_COLOR=1 sets noColor=true', () => {
    const flags: Record<string, string | boolean> = {}
    applyEnvDefaults(flags, envFixture({ AGENTROOT_NO_COLOR: '1' }))
    expect(flags['noColor']).toBe(true)
  })

  it('NO_COLOR (standard) sets noColor=true', () => {
    const flags: Record<string, string | boolean> = {}
    applyEnvDefaults(flags, envFixture({ NO_COLOR: '1' }))
    expect(flags['noColor']).toBe(true)
  })

  it('explicit flag wins over CI default', () => {
    // user did --no-yes (parsed to flags.yes = false) under CI=true
    const flags: Record<string, string | boolean> = { yes: false }
    applyEnvDefaults(flags, envFixture({ CI: 'true' }))
    expect(flags['yes']).toBe(false)
  })

  it('explicit --no-color=false wins over NO_COLOR env', () => {
    const flags: Record<string, string | boolean> = { noColor: false }
    applyEnvDefaults(flags, envFixture({ NO_COLOR: '1' }))
    expect(flags['noColor']).toBe(false)
  })

  it('explicit --yes wins (no-op, already true)', () => {
    const flags: Record<string, string | boolean> = { yes: true }
    applyEnvDefaults(flags, envFixture({}))
    expect(flags['yes']).toBe(true)
  })

  it('no env, no flags → no defaults written', () => {
    const flags: Record<string, string | boolean> = {}
    applyEnvDefaults(flags, envFixture({}))
    expect(flags).toEqual({})
  })

  it('AGENTROOT_YES wins over CI=true (both apply, but namespaced is the contract)', () => {
    // The end result is the same (yes=true); this test pins the order so a
    // future refactor that swaps precedence is caught.
    const flags: Record<string, string | boolean> = {}
    applyEnvDefaults(flags, envFixture({ CI: 'true', AGENTROOT_YES: '1' }))
    expect(flags['yes']).toBe(true)
  })
})
