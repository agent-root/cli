import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { colors, configureColors, isColorDisabled, setColorsDisabledForTest } from '../../src/cli/colors'

const ORIGINAL_ENV = { ...process.env }

function clearColorEnv(): void {
  delete process.env['NO_COLOR']
  delete process.env['FORCE_COLOR']
  delete process.env['AGENTROOT_NO_COLOR']
}

describe('colors module', () => {
  beforeEach(() => {
    clearColorEnv()
    // Pretend we're in a TTY by default so the auto-detection branch doesn't
    // suppress color in tests; individual tests opt back in to non-TTY.
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true })
    setColorsDisabledForTest(null)
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    setColorsDisabledForTest(null)
  })

  it('configureColors({}) with NO_COLOR set disables color', () => {
    process.env['NO_COLOR'] = '1'
    configureColors({})
    expect(isColorDisabled()).toBe(true)
    // The wrapped helpers must return the raw string with no ANSI escapes.
    expect(colors.bold('x')).toBe('x')
    expect(colors.cyan('y')).toBe('y')
  })

  it('configureColors({}) with empty NO_COLOR does NOT disable color', () => {
    process.env['NO_COLOR'] = ''
    configureColors({})
    // Empty string is not "set" per the no-color.org standard. The wrapper
    // must NOT mark itself disabled (the actual ANSI output is whatever
    // picocolors itself decided at import time; we only own the wrapper).
    expect(isColorDisabled()).toBe(false)
  })

  it('configureColors({ noColor: true }) disables color', () => {
    configureColors({ noColor: true })
    expect(isColorDisabled()).toBe(true)
    expect(colors.bold('x')).toBe('x')
    expect(colors.red('err')).toBe('err')
  })

  it('configureColors({}) with no env and TTY does not mark disabled', () => {
    configureColors({})
    // Whether the actual ANSI escape is emitted depends on picocolors' own
    // TTY check at import time; under vitest stdin is not a TTY, so picocolors
    // itself often returns the raw string. Our contract is: the wrapper does
    // not add a *second* layer of stripping.
    expect(isColorDisabled()).toBe(false)
  })

  it('configureColors({}) disables color when not a TTY', () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true })
    configureColors({})
    expect(isColorDisabled()).toBe(true)
    expect(colors.dim('hint')).toBe('hint')
  })

  it('FORCE_COLOR=0 disables color', () => {
    process.env['FORCE_COLOR'] = '0'
    configureColors({})
    expect(isColorDisabled()).toBe(true)
  })

  it('AGENTROOT_NO_COLOR set disables color', () => {
    process.env['AGENTROOT_NO_COLOR'] = '1'
    configureColors({})
    expect(isColorDisabled()).toBe(true)
  })

  it('lazy fallback honors NO_COLOR even without configureColors()', () => {
    // Skip the explicit configure step; isColorDisabled should still read env.
    process.env['NO_COLOR'] = '1'
    expect(isColorDisabled()).toBe(true)
  })

  it('every wrapped helper returns raw input when disabled', () => {
    configureColors({ noColor: true })
    expect(colors.bold('a')).toBe('a')
    expect(colors.dim('a')).toBe('a')
    expect(colors.cyan('a')).toBe('a')
    expect(colors.green('a')).toBe('a')
    expect(colors.red('a')).toBe('a')
    expect(colors.yellow('a')).toBe('a')
  })
})
