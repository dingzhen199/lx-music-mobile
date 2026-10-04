const resolvedMocks = vi.hoisted(() => ({ url: vi.fn(), resource: vi.fn(), toast: vi.fn() }))
vi.mock('@/store/common/state', () => ({ default: { fontSize: 1, navActiveId: 'nav_search' } }))
vi.mock('@/core/common', () => ({ setNavActiveId: vi.fn() }))
vi.mock('react-native', () => ({ Dimensions: { get: () => ({ width: 400, height: 800 }) }, Platform: { OS: 'android', select: (v: any) => v.android }, PixelRatio: { get: () => 1, getFontScale: () => 1, roundToNearestPixel: (n: number) => n } }))
import { beforeEach, expect, it, vi } from 'vitest'
import { StateEvent } from '@/event/stateEvent'
import { AppEvent } from '@/event/appEvent'
vi.mock('@/store/setting/state', () => ({ default: { setting: { 'player.togglePlayMethod': 'list' } } }))
vi.mock('@/utils/common', () => ({ getRandom: () => 0 }))
vi.mock('@/utils', () => ({ arrPush: (a: unknown[], b: unknown[]) => a.push(...b), arrUnshift: (a: unknown[], b: unknown[]) => a.unshift(...b), formatPlayTime2: String }))
vi.mock('@/plugins/player', () => ({ isInitialized: () => true, setStop: async() => {}, setPause: vi.fn(), setPlay: vi.fn(), setResource: resolvedMocks.resource }))
vi.mock('@/core/music', () => ({ getMusicUrl: resolvedMocks.url, getPicPath: vi.fn(), getLyricInfo: vi.fn() }))
vi.mock('@/utils/tools', () => ({ debounceBackgroundTimer: () => () => {}, toast: resolvedMocks.toast }))
vi.mock('@/utils/listManage', () => ({ getListMusicSync: () => [] }))
vi.mock('@/core/player/progress', () => ({ setProgress: vi.fn() }))
vi.mock('@/core/list', () => ({ addListMusics: vi.fn(), removeListMusics: vi.fn() }))
vi.mock('@/core/dislikeList', () => ({ addDislikeInfo: vi.fn() }))
vi.mock('./utils', () => ({ filterList: vi.fn() }))
vi.mock('react-native-background-timer', () => ({ default: { setTimeout: () => 1, clearTimeout: vi.fn() } }))
import actions from '@/store/player/action'
import state from '@/store/player/state'
import { playSelectedList, playNext, getNextPlayMusicInfo, setMusicUrl } from './player'
const song = (id: string) => ({ id, source: 'wy', name: id, singer: '', interval: null, meta: {} }) as LX.Music.MusicInfoOnline
beforeEach(() => {
  vi.stubGlobal('state_event', new StateEvent()); vi.stubGlobal('app_event', new AppEvent())
  vi.stubGlobal('lx', { isPlayedStop: false, restorePlayInfo: null })
  vi.stubGlobal('i18n', { t: (key: string) => key })
  vi.clearAllMocks()
  state.isPlay = false
  actions.setPlayListId('old'); actions.clearTempPlayeList(); actions.clearPlayedList()
})
it('real queue plays every selected row once in supplied visible order and drops old continuation', async() => {
  actions.addTempPlayList([{ listId: 'old', musicInfo: song('old') }])
  playSelectedList([song('a'), song('c'), song('b')], 'owned')
  expect(state.playInfo.playerListId).toBeNull()
  expect(state.playMusicInfo.musicInfo?.id).toBe('a')
  expect(state.tempPlayList.map(item => item.musicInfo.id)).toEqual(['c', 'b'])
  expect((await getNextPlayMusicInfo())?.musicInfo.id).toBe('c')
  await playNext()
  expect(state.playMusicInfo.musicInfo?.id).toBe('c')
  await playNext()
  expect(state.playMusicInfo.musicInfo?.id).toBe('b')
  expect(await getNextPlayMusicInfo()).toBeNull()
})
it('new selection replaces pending batch and runtime resolution clears on next track', () => {
  playSelectedList([song('a'), song('b')])
  actions.setResolvedMusicInfo(song('rescue'))
  playSelectedList([song('c')])
  expect(state.playMusicInfo.musicInfo?.id).toBe('c')
  expect(state.playMusicInfo.resolvedMusicInfo).toBeUndefined()
  expect(state.tempPlayList).toEqual([])
})

it('actual URL commit records temporary resolution and notifies without changing selected identity', async() => {
  const original = song('a')
  const preferred = song('b')
  const rescue = song('c')
  original.meta.toggleMusicInfo = preferred
  original.meta.manualVersionPinned = true
  playSelectedList([original])
  resolvedMocks.url.mockImplementation(async(args) => { args.onResolvedMusicInfo(rescue); return 'https://audio.test/rescue' })
  setMusicUrl(original)
  await vi.waitFor(() => { expect(resolvedMocks.resource).toHaveBeenCalled() })
  expect(state.playMusicInfo.musicInfo).toBe(original)
  expect(original.meta.toggleMusicInfo).toBe(preferred)
  expect(state.playMusicInfo.resolvedMusicInfo).toBe(rescue)
  expect(resolvedMocks.toast).toHaveBeenCalledOnce()
})
it('local URL-only rescue is explicitly marked unknown rather than inventing a provider identity', async() => {
  const original = { id: 'file', source: 'local', name: 'file', singer: '', interval: null, meta: { filePath: '/missing.mp3', ext: 'mp3', albumName: '', songId: 'file' } } as LX.Music.MusicInfoLocal
  playSelectedList([original])
  resolvedMocks.url.mockImplementation(async(args) => { args.onToggleSource(); return 'https://audio.test/local-rescue' })
  setMusicUrl(original)
  await vi.waitFor(() => { expect(resolvedMocks.resource).toHaveBeenCalled() })
  expect(state.playMusicInfo.musicInfo).toBe(original)
  expect(state.playMusicInfo.temporarySourceUnknown).toBe(true)
  expect(state.playMusicInfo.resolvedMusicInfo).toBeUndefined()
  expect(resolvedMocks.toast).toHaveBeenCalledOnce()
})
