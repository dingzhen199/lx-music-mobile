import { describe, it, expect } from 'vitest'
import { normalizeApiSourceBackups } from './userApiConfig'
import { createRuntimeRegistry } from './userApiRuntime'

describe('user API isolation', () => {
  it('normalizes ordered backups without primary or duplicates', () => {
    expect(normalizeApiSourceBackups('a', ['b', 'a', '', 'b', null, 'c'])).toEqual(['b', 'c'])
  })
  it('rejects events from previous generations including same-ID reloads', () => {
    const registry = createRuntimeRegistry<{ name: string }>()
    const old = registry.load('a', { name: 'old' })
    const current = registry.load('a', { name: 'new' })
    expect(registry.get('a', old)).toBeUndefined()
    expect(registry.get('a', current)?.name).toBe('new')
    registry.remove('a')
    expect(registry.get('a', current)).toBeUndefined()
  })
  it('keeps main and backup identities independent', () => {
    const registry = createRuntimeRegistry<string>()
    const a = registry.load('a', 'main')
    const b = registry.load('b', 'backup')
    expect(registry.get('a', b)).toBeUndefined()
    registry.remove('a')
    expect(registry.get('b', b)).toBe('backup')
    expect(registry.get('a', a)).toBeUndefined()
  })
})
