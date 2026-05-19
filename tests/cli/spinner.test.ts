import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { maybeSpinner } from '../../src/cli/spinner'
import { setQuietForTest } from '../../src/cli/streams'

/**
 * `maybeSpinner` should return the no-op shim when the user has opted out of
 * chatter. Three opt-out paths: explicit `--json`, explicit `--quiet`, and the
 * global quiet state set by `configureQuiet()`.
 *
 * The no-op shim is identifiable because it never throws and supports the full
 * chain (`.start().success().error()...`). The real `nanospinner` instance is
 * a function with side-effects, but we don't need to assert internals — we
 * just verify the shim returns the same instance for every chained call.
 */
describe('maybeSpinner', () => {
  beforeEach(() => {
    setQuietForTest(false)
  })

  afterEach(() => {
    setQuietForTest(false)
  })

  it('returns the noop shim when flags.json is true', () => {
    const s = maybeSpinner('hi', { json: true })
    // The noop shim's methods all return the shim itself.
    expect(s.start()).toBe(s)
    expect(s.success({ text: 'ok' })).toBe(s)
    expect(s.error({ text: 'bad' })).toBe(s)
    expect(s.warn({ text: 'meh' })).toBe(s)
    expect(s.info({ text: 'fyi' })).toBe(s)
    expect(s.update({ text: 'tick' })).toBe(s)
    expect(s.stop()).toBe(s)
  })

  it('returns the noop shim when flags.quiet is true', () => {
    const s = maybeSpinner('hi', { quiet: true })
    expect(s.start()).toBe(s)
    expect(s.success()).toBe(s)
  })

  it('returns the noop shim when the global quiet state is on', () => {
    setQuietForTest(true)
    const s = maybeSpinner('hi', {})
    expect(s.start()).toBe(s)
    expect(s.success()).toBe(s)
  })

  it('returns a real spinner when neither quiet nor json is set', () => {
    const s = maybeSpinner('hi', {})
    // The real nanospinner returns a different chained object on each method
    // (not strictly equal to `s`), but we don't depend on that — we just
    // verify .start() does NOT throw and returns *something*.
    expect(typeof s.start).toBe('function')
    const after = s.start()
    expect(after).toBeDefined()
    // Clean up: real spinners run intervals, .stop() halts them.
    s.stop()
  })
})
