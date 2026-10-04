vi.mock('@/store/player/action', () => ({ default: { updateQueuedVersion: vi.fn() } }))
import { expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ list: [] as LX.Music.MusicInfo[], update: vi.fn(), play: vi.fn() }))
vi.mock('@/core/list', () => ({ updateListMusics: mocks.update, addListMusics: vi.fn(), removeListMusics: vi.fn(), updateListMusicPosition: vi.fn() }))
vi.mock('@/core/player/player', () => ({ reloadVersion: mocks.play }))
vi.mock('@/core/player/tempPlayList', () => ({ addTempPlayList: vi.fn() }))
vi.mock('@/core/dislikeList', () => ({}))
vi.mock('@/store/setting/state', () => ({ default: { setting: {} } }))
vi.mock('@/utils', () => ({}))
vi.mock('@/utils/tools', () => ({}))
vi.mock('@/utils/musicSdk', () => ({ default: {} }))
vi.mock('@/utils/data', () => ({}))
vi.mock('@/utils/listManage', () => ({ getListMusicSync: () => mocks.list }))
import playerState from '@/store/player/state'
import { handleToggleSource } from '@/screens/Home/Views/Mylist/MusicList/listAction'
const song = (id: string) => ({ id, source: 'wy', name: id, singer: '', meta: { albumName: '' } }) as LX.Music.MusicInfoOnline
it('actual manual handler persists A→B→A without removing the original collection entry', async() => {
  const a = song('a'); const b = song('b')
  mocks.list = [a]
  mocks.update.mockImplementation(async([{ musicInfo }]) => { mocks.list = [musicInfo] })
  await handleToggleSource('owned', a, b)
  expect(mocks.list[0]).toMatchObject({ id: 'a', meta: { toggleMusicInfo: { id: 'b' }, manualVersionPinned: true } })
  await handleToggleSource('owned', mocks.list[0], a)
  expect(mocks.list[0]).toMatchObject({ id: 'a', meta: { toggleMusicInfo: null, manualVersionPinned: true } })
})

it('confirming the actual preview returns playback to the stable collection identity', async() => {
  const a = song('a'); const b = song('b')
  mocks.list = [a]
  playerState.playMusicInfo = { musicInfo: b, listId: 'playLater', isTempPlay: true }
  await handleToggleSource('owned', a, b)
  expect(mocks.play).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), 'owned', expect.any(Object))
})

it('restoring A after preview C uses saved owner context, independent of selected candidate', async() => {
  const a = song('a'); const b = song('b'); const c = song('c')
  a.meta.toggleMusicInfo = b
  mocks.list = [a]
  const context = { musicInfo: a, listId: 'owned', isTempPlay: true }
  playerState.playMusicInfo = { musicInfo: c, listId: null, isTempPlay: true }
  await handleToggleSource('owned', a, a, context)
  expect(mocks.play).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'a', meta: expect.objectContaining({ toggleMusicInfo: null }) }), 'owned', context)
})
