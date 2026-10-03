import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ fetch: vi.fn(), overwrite: vi.fn(), time: vi.fn(), error: vi.fn(), status: vi.fn() }))
vi.mock('@/utils/data', () => ({ setListUpdateTime: m.time, setListUpdateError: m.error }))
vi.mock('./list', () => ({ overwriteListMusics: m.overwrite, setFetchingListStatus: m.status }))
vi.mock('@/core/songlist', () => ({ getListDetailAll: m.fetch }))
vi.mock('@/core/leaderboard', () => ({ getListDetailAll: m.fetch }))
import sync from './syncSourceList'
const list = { id: 'local', name: 'Online', source: 'wy' as const, sourceListId: '123', locationUpdateTime: null }
beforeEach(() => { vi.clearAllMocks(); m.fetch.mockResolvedValue([]); m.overwrite.mockResolvedValue(undefined); m.error.mockResolvedValue(undefined) })
it('awaits persistence before recording successful update time', async() => {
  let finish!: () => void
  m.overwrite.mockReturnValue(new Promise<void>(resolve => { finish = resolve }))
  const task = sync(list)
  await vi.waitFor(() => { expect(m.overwrite).toHaveBeenCalled() })
  expect(m.time).not.toHaveBeenCalled()
  finish()
  await task
  expect(m.time).toHaveBeenCalledWith('local', expect.any(Number))
  expect(m.error).toHaveBeenCalledWith('local', null)
})
it('keeps the success time untouched and stores write failures', async() => {
  m.overwrite.mockRejectedValue(new Error('disk full'))
  await expect(sync(list)).rejects.toThrow('disk full')
  expect(m.time).not.toHaveBeenCalled()
  expect(m.error).toHaveBeenCalledWith('local', 'disk full')
})
it('does not overwrite local songs when remote loading fails', async() => {
  m.fetch.mockRejectedValue(new Error('offline'))
  await expect(sync(list)).rejects.toThrow('offline')
  expect(m.overwrite).not.toHaveBeenCalled()
  expect(m.status).toHaveBeenLastCalledWith('local', false)
})
