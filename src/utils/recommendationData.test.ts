import { beforeEach, expect, it, vi } from 'vitest'
const storage = vi.hoisted(() => ({ save: vi.fn() }))
vi.mock('@/plugins/storage', () => ({ saveData: storage.save }))
beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })
it('snapshot writes are ordered per key, failures observed and later saves recover', async() => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const data = await import('./data')
  let reject!: (reason: Error) => void
  storage.save.mockImplementationOnce(async() => new Promise<void>((_resolve, fail) => { reject = fail })).mockResolvedValue(undefined)
  const state = { loves: 1 }
  data.saveRecommendProfile(state)
  state.loves = 2
  data.saveRecommendProfile(state)
  await vi.waitFor(() => { expect(storage.save).toHaveBeenCalledOnce() })
  expect(storage.save.mock.calls[0][1]).toEqual({ loves: 1 })
  reject(new Error('disk full'))
  await vi.waitFor(() => { expect(storage.save).toHaveBeenCalledTimes(2) })
  expect(storage.save.mock.calls[1][1]).toEqual({ loves: 2 })
  expect(warn).toHaveBeenCalledOnce()
  warn.mockRestore()
})
