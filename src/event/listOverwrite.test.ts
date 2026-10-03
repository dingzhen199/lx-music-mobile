import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ save: vi.fn(), notify: vi.fn() }))
vi.mock('@/utils/data', () => ({
  saveListMusics: m.save, saveUserList: vi.fn(), removeListMusics: vi.fn(), getUserLists: vi.fn(), getListMusics: vi.fn(),
  overwriteListPosition: vi.fn(), overwriteListUpdateInfo: vi.fn(), removeListPosition: vi.fn(), removeListUpdateInfo: vi.fn(),
}))
vi.mock('@/core/list', () => ({ setActiveList: vi.fn(), setUserList: vi.fn() }))
vi.mock('@/store/list/state', () => ({ default: { activeListId: 'test', allList: [] } }))
import { ListEvent } from './listEvent'
import { allMusicList } from '@/utils/listManage'
const old = [{ id: 'old' }] as LX.Music.MusicInfo[]
const replacement = [{ id: 'new' }] as LX.Music.MusicInfo[]
beforeEach(() => {
  vi.clearAllMocks()
  allMusicList.clear()
  allMusicList.set('test', old)
  vi.stubGlobal('app_event', { myListMusicUpdate: m.notify })
  m.save.mockResolvedValue(undefined)
})
it('keeps the previous in-memory list and emits nothing on persistence failure', async() => {
  m.save.mockRejectedValueOnce(new Error('disk full'))
  const events = new ListEvent()
  await expect(events.list_music_overwrite('test', replacement)).rejects.toThrow('disk full')
  expect(allMusicList.get('test')).toBe(old)
  expect(m.notify).not.toHaveBeenCalled()
})
it('publishes the new list only once persistence succeeds', async() => {
  let finish!: () => void
  m.save.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve }))
  const task = new ListEvent().list_music_overwrite('test', replacement)
  expect(allMusicList.get('test')).toBe(old)
  finish()
  await task
  expect(allMusicList.get('test')).toBe(replacement)
  expect(m.notify).toHaveBeenCalledWith(['test'])
})
