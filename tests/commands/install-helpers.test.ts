import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@agent-root/core', async () => {
  const actual = await vi.importActual<typeof import('@agent-root/core')>('@agent-root/core')
  return {
    ...actual,
    detectTools: vi.fn(() => []),
  }
})

import * as core from '@agent-root/core'
import { detectTargetTools } from '../../src/services/install/detect-target-tools'

describe('detectTargetTools', () => {
  beforeEach(() => {
    vi.mocked(core.detectTools).mockReset()
  })

  it('honors --tool flag and short-circuits detection', () => {
    const result = detectTargetTools({ tool: 'claude' })
    expect(result).toEqual(['claude'])
    expect(core.detectTools).not.toHaveBeenCalled()
  })

  it('honors _selectedTools when present (from interactive picker)', () => {
    const result = detectTargetTools({ _selectedTools: ['cursor', 'codex'] })
    expect(result).toEqual(['cursor', 'codex'])
    expect(core.detectTools).not.toHaveBeenCalled()
  })

  it('prefers --tool over _selectedTools when both are set', () => {
    const result = detectTargetTools({ _selectedTools: ['cursor'], tool: 'gemini' })
    expect(result).toEqual(['cursor'])
  })

  it('falls back to detected tools when no flag is set', () => {
    vi.mocked(core.detectTools).mockReturnValue(['claude', 'cursor'])
    const result = detectTargetTools({})
    expect(result).toEqual(['claude', 'cursor'])
    expect(core.detectTools).toHaveBeenCalledOnce()
  })

  it('falls back to ["agents"] when nothing is detected', () => {
    vi.mocked(core.detectTools).mockReturnValue([])
    const result = detectTargetTools({})
    expect(result).toEqual(['agents'])
  })

  it('ignores empty _selectedTools array', () => {
    vi.mocked(core.detectTools).mockReturnValue(['claude'])
    const result = detectTargetTools({ _selectedTools: [] })
    expect(result).toEqual(['claude'])
  })

  it('treats _selectedTools with values as authoritative even when --json is set', () => {
    const result = detectTargetTools({ _selectedTools: ['claude'], json: true })
    expect(result).toEqual(['claude'])
  })
})
