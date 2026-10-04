import { beforeEach, expect, it, vi } from 'vitest'
import { storageDataPrefix } from '@/config/constant'
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
const prefix = storageDataPrefix.userApi
const old = { id: 'user_api_old', name: 'Old', description: '', author: '', homepage: '', version: '', allowShowUpdateAlert: true }
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); storage.data.clear()
  storage.data.set(prefix, JSON.stringify([old]))
  storage.data.set(prefix + old.id, JSON.stringify('old script'))
  storage.getItem.mockImplementation(async(key) => storage.data.get(key) ?? null)
  storage.multiGet.mockImplementation(async(keys) => keys.map(key => [key, storage.data.get(key) ?? null]))
  storage.multiSet.mockImplementation(async(entries) => { for (const [key, value] of entries) storage.data.set(key, value) })
  vi.stubGlobal('i18n', { t: (key: string) => key })
})
it.each(['rejected', 'committed-error', 'read-error'] as const)('reconciles an imported large script after deferred %s list publication', async(mode) => {
  const data = await import('./data')
  const { getData } = await import('@/plugins/storage')
  await data.getUserApiList()
  let finish!: () => void
  storage.multiSet.mockImplementation(async(entries) => {
    if (entries.some(([key]) => key === prefix)) {
      await new Promise<void>(resolve => { finish = resolve })
      if (mode === 'committed-error') for (const [key, value] of entries) storage.data.set(key, value)
      if (mode === 'read-error') storage.getItem.mockRejectedValueOnce(new Error('list read failed'))
      throw new Error('list commit failed')
    }
    for (const [key, value] of entries) storage.data.set(key, value)
  })
  const script = '/**\n * @name New\n */\n' + 'x'.repeat(600000)
  const pending = data.addUserApi(script)
  const rejected = expect(pending).rejects.toThrow('list commit failed')
  await vi.waitFor(() => { expect(finish).toBeTypeOf('function') })
  const stagedRoot = [...storage.data.keys()].find(key => key.startsWith(prefix + 'user_api_') && key !== prefix + old.id)!
  expect(stagedRoot).toBeTruthy()
  expect(storage.multiRemove).not.toHaveBeenCalled()
  finish()
  await rejected
  expect(storage.data.has(stagedRoot)).toBe(mode !== 'rejected')
  expect([...storage.data.keys()].filter(key => key.startsWith('@___PART_A___'))).toHaveLength(mode === 'rejected' ? 0 : 2)
  expect(storage.data.get(prefix + old.id)).toBe(JSON.stringify('old script'))
  if (mode === 'committed-error') {
    await expect(getData(stagedRoot)).resolves.toBe(script)
    // A later import must not replace the durable source whose commit reported an error.
    storage.multiSet.mockImplementation(async(entries) => { for (const [key, value] of entries) storage.data.set(key, value) })
    await data.addUserApi('/**\n * @name Later\n */')
    expect((await data.getUserApiList()).map(api => api.name)).toEqual(['Old', 'New', 'Later'])
  }
})
