import { beforeEach, expect, it, vi } from 'vitest'
import { storageDataPrefix } from '@/config/constant'
const storage = vi.hoisted(() => ({ data: new Map<string, any>(), save: vi.fn(), remove: vi.fn() }))
vi.mock('@/plugins/storage', () => ({
  getData: async(key: string) => storage.data.has(key) ? JSON.parse(JSON.stringify(storage.data.get(key))) : null,
  saveData: storage.save, removeDataMultiple: storage.remove,
  getAllKeys: vi.fn(), saveDataMultiple: vi.fn(), removeData: vi.fn(), getDataMultiple: vi.fn(),
}))
const prefix = storageDataPrefix.userApi
const old = { id: 'user_api_old', name: 'Old', description: '', author: '', homepage: '', version: '', allowShowUpdateAlert: true }
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); storage.data.clear()
  storage.data.set(prefix, [old]); storage.data.set(prefix + old.id, 'old script')
  storage.save.mockImplementation(async(key: string, value: any) => { storage.data.set(key, JSON.parse(JSON.stringify(value))) })
  storage.remove.mockImplementation(async(keys: string[]) => { for (const key of keys) storage.data.delete(key) })
  vi.stubGlobal('i18n', { t: (key: string) => key })
})
it('serializes deferred import and delete without resurrecting a deleted source', async() => {
  const data = await import('./data')
  await data.getUserApiList()
  let finish!: () => void
  storage.save.mockImplementationOnce(async(key, value) => {
    await new Promise<void>(resolve => { finish = resolve })
    storage.data.set(key, value)
  })
  const imported = data.addUserApi('/**\n * @name New\n */\n')
  await vi.waitFor(() => { expect(finish).toBeTypeOf('function') })
  const ids = [old.id]
  const removed = data.removeUserApi(ids)
  await Promise.resolve()
  expect(storage.remove).not.toHaveBeenCalled()
  finish()
  const added = await imported
  await removed
  expect(ids).toEqual([old.id])
  expect((await data.getUserApiList()).map(api => api.id)).toEqual([added.id])
  expect(storage.data.has(prefix + old.id)).toBe(false)
  expect(storage.data.has(prefix + added.id)).toBe(true)
})
it('failed update-alert persistence leaves the previous in-memory and stored values intact', async() => {
  const data = await import('./data')
  const list = await data.getUserApiList()
  storage.save.mockRejectedValueOnce(new Error('disk full'))
  await expect(data.setUserApiAllowShowUpdateAlert(old.id, false)).rejects.toThrow('disk full')
  expect(list[0].allowShowUpdateAlert).toBe(true)
  expect(storage.data.get(prefix)[0].allowShowUpdateAlert).toBe(true)
  await data.setUserApiAllowShowUpdateAlert(old.id, false)
  expect((await data.getUserApiList())[0].allowShowUpdateAlert).toBe(false)
})
it('failed import publication cannot add a phantom API to the next import', async() => {
  const data = await import('./data')
  await data.getUserApiList()
  storage.save.mockImplementationOnce(async(key, value) => { storage.data.set(key, value) }).mockRejectedValueOnce(new Error('list failed'))
  await expect(data.addUserApi('/**\n * @name Failed\n */')).rejects.toThrow('list failed')
  await data.addUserApi('/**\n * @name Good\n */')
  expect((await data.getUserApiList()).map(api => api.name)).toEqual(['Old', 'Good'])
})
