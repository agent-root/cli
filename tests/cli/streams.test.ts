import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { note, configureQuiet, isQuiet, setQuietForTest } from '../../src/cli/streams'

// The global tests/setup.ts already wraps console.log/console.error in mocks,
// so we just read from those spies. note() delegates to console.error which
// writes to process.stderr; console.log goes to process.stdout. We rely on
// the global setup's spy to observe call counts.

describe('streams module', () => {
  beforeEach(() => {
    setQuietForTest(false)
    // The global setupFiles spy installs every beforeEach; we just clear any
    // residue from prior tests in the same suite so call counts are clean.
    vi.mocked(console.error).mockClear()
    vi.mocked(console.log).mockClear()
  })

  afterEach(() => {
    setQuietForTest(false)
  })

  it('note() writes via console.error (stderr), not console.log (stdout)', () => {
    note('hello')
    expect(console.error).toHaveBeenCalledWith('hello')
    expect(console.log).not.toHaveBeenCalled()
  })

  it('note() respects quiet mode (no output at all)', () => {
    setQuietForTest(true)
    note('hello')
    expect(console.error).not.toHaveBeenCalled()
    expect(console.log).not.toHaveBeenCalled()
  })

  it('note() forwards multiple args like console.error', () => {
    note('foo', 'bar', 42)
    expect(console.error).toHaveBeenCalledWith('foo', 'bar', 42)
  })

  it('configureQuiet({ quiet: true }) sets the global flag', () => {
    configureQuiet({ quiet: true })
    expect(isQuiet()).toBe(true)
    note('x')
    expect(console.error).not.toHaveBeenCalled()
  })

  it('configureQuiet({}) clears the global flag', () => {
    setQuietForTest(true)
    configureQuiet({})
    expect(isQuiet()).toBe(false)
    note('x')
    expect(console.error).toHaveBeenCalledWith('x')
  })

  it('isQuiet() returns the current quiet state', () => {
    expect(isQuiet()).toBe(false)
    setQuietForTest(true)
    expect(isQuiet()).toBe(true)
  })
})
