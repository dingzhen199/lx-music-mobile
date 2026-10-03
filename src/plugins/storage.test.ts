import { beforeEach, describe, expect, it, vi } from 'vitest'
const storage = vi.hoisted(() => {
  const data = new Map<string, string>()
  return {
    data,
    getItem: vi.fn(async(key: string) => data.get(key) ?? null),
    multiGet: vi.fn(async(keys: string[]) => keys.map(key => [key, data.get(key) ?? null])),
    multiSet: vi.fn(async(entries: Array<[string, string]>) => { for (const [key, value] of entries) data.set(key, value) }),
    multiRemove: vi.fn(async(keys: string[]) => { for (const key of keys) data.delete(key) }),
    removeItem: vi.fn(async(key: string) => { data.delete(key) }),
  }
})
vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }))
vi.mock('@/utils/log', () => ({ log: { error: vi.fn(), warn: vi.fn() } }))
import { getData, saveData, saveDataMultiple } from './storage'
beforeEach(() => {
  storage.data.clear()
  vi.clearAllMocks()
  storage.multiSet.mockImplementation(async(entries) => { for (const [key, value] of entries) storage.data.set(key, value) })
  storage.multiRemove.mockImplementation(async(keys) => { for (const key of keys) storage.data.delete(key) })
})
describe('storage overwrite safety', () => {
  it('keeps an existing small value when writing its replacement fails', async() => {
    await saveData('list', ['old'])
    storage.multiSet.mockRejectedValueOnce(new Error('disk full'))
    await expect(saveData('list', ['new'])).rejects.toThrow('disk full')
    await expect(getData('list')).resolves.toEqual(['old'])
  })
  it('does not overwrite old chunks while staging a large replacement', async() => {
    const old = 'a'.repeat(600000)
    await saveData('script', old)
    const originalKeys = [...storage.data.keys()]
    storage.multiSet.mockImplementationOnce(async(entries) => {
      storage.data.set(entries[0][0], entries[0][1])
      throw new Error('partial chunk write')
    })
    await expect(saveData('script', 'b'.repeat(600000))).rejects.toThrow('partial chunk write')
    await expect(getData('script')).resolves.toBe(old)
    expect(originalKeys.every(key => storage.data.has(key))).toBe(true)
  })
  it('preserves old chunks if the pointer commit fails after staging', async() => {
    await saveData('script', 'a'.repeat(600000))
    storage.multiSet.mockImplementationOnce(async(entries) => {
      for (const [key, value] of entries) storage.data.set(key, value)
    }).mockRejectedValueOnce(new Error('commit failed'))
    await expect(saveData('script', 'b'.repeat(600000))).rejects.toThrow('commit failed')
    await expect(getData('script')).resolves.toBe('a'.repeat(600000))
  })
  it('cleans retired chunks only after a successful replacement', async() => {
    await saveData('script', 'a'.repeat(600000))
    const retired = [...storage.data.keys()].filter(key => key !== 'script')
    await saveData('script', 'small')
    await expect(getData('script')).resolves.toBe('small')
    expect(retired.every(key => !storage.data.has(key))).toBe(true)
  })
  it('does not report a committed write as failed when orphan cleanup fails', async() => {
    await saveData('script', 'a'.repeat(600000))
    storage.multiRemove.mockRejectedValueOnce(new Error('cleanup failed'))
    await expect(saveData('script', 'small')).resolves.toBeUndefined()
    await expect(getData('script')).resolves.toBe('small')
  })
  it('batch write failure does not remove old root values', async() => {
    await saveDataMultiple([['a', 1], ['b', 2]])
    storage.multiSet.mockRejectedValueOnce(new Error('batch failed'))
    await expect(saveDataMultiple([['a', 3], ['b', 4]])).rejects.toThrow('batch failed')
    await expect(getData('a')).resolves.toBe(1)
    await expect(getData('b')).resolves.toBe(2)
  })
})
