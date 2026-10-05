const resolvedMocks = vi.hoisted(() => ({ runDebounce: false, pic: vi.fn(), lyric: vi.fn(), url: vi.fn(), resource: vi.fn(), toast: vi.fn() }))
vi.mock('@/store/common/state', () => ({ default: { fontSize: 1, navActiveId: 'nav_search' } }))
vi.mock('@/core/common', () => ({ setNavActiveId: vi.fn() }))
vi.mock('react-native', () => ({ Dimensions: { get: () => ({ width: 400, height: 800 }) }, Platform: { OS: 'android', select: (v: any) => v.android }, PixelRatio: { get: () => 1, getFontScale: () => 1, roundToNearestPixel: (n: number) => n } }))
import { beforeEach, expect, it, vi } from 'vitest'
import { StateEvent } from '@/event/stateEvent'
import { AppEvent } from '@/event/appEvent'
vi.mock('@/store/setting/state', () => ({ default: { setting: { 'player.togglePlayMethod': 'list' } } }))
const random = vi.hoisted(() => vi.fn(() => 0))
vi.mock('@/utils/common', () => ({ getRandom: random }))
vi.mock('@/utils', () => ({ arrPush: (a: unknown[], b: unknown[]) => a.push(...b), arrUnshift: (a: unknown[], b: unknown[]) => a.unshift(...b), formatPlayTime2: String }))
vi.mock('@/plugins/player', () => ({ isInitialized: () => true, setStop: async() => {}, setPause: vi.fn(), setPlay: vi.fn(), setResource: resolvedMocks.resource }))
vi.mock('@/core/music', () => ({ getMusicUrl: resolvedMocks.url, getPicPath: resolvedMocks.pic, getLyricInfo: resolvedMocks.lyric }))
vi.mock('@/utils/tools', () => ({ debounceBackgroundTimer: (fn: (info: unknown) => void) => (info: unknown) => { if (resolvedMocks.runDebounce) fn(info) }, toast: resolvedMocks.toast }))
const listMocks = vi.hoisted(() => ({ list: [] as any[] }))
vi.mock('@/utils/listManage', () => ({ getListMusicSync: () => listMocks.list }))
vi.mock('@/core/player/progress', () => ({ setProgress: vi.fn() }))
vi.mock('@/core/list', () => ({ addListMusics: vi.fn(), removeListMusics: vi.fn() }))
vi.mock('@/core/dislikeList', () => ({ addDislikeInfo: vi.fn() }))
const filter = vi.hoisted(() => vi.fn(async({ list, playerMusicInfo }: any) => ({ filteredList: list, playerIndex: list.indexOf(playerMusicInfo) })))
vi.mock('./utils', () => ({ filterList: filter }))
vi.mock('react-native-background-timer', () => ({ default: { setTimeout: () => 1, clearTimeout: vi.fn() } }))
import settings from '@/store/setting/state'
import actions from '@/store/player/action'
import state from '@/store/player/state'
import { playNext, getNextPlayMusicInfo, playQueueItem, moveQueueItem, removeQueueItem, clearPlaybackQueue, resetRandomNextMusicInfo, queueItemNext, playListById } from './player'
const song = (id: string) => ({ id, source: 'wy', name: id, singer: '', interval: null, meta: {} }) as LX.Music.MusicInfoOnline
beforeEach(() => {
  vi.stubGlobal('state_event', new StateEvent()); vi.stubGlobal('app_event', new AppEvent())
  vi.stubGlobal('lx', { isPlayedStop: false, restorePlayInfo: null })
  vi.stubGlobal('i18n', { t: (key: string) => key })
  vi.clearAllMocks()
  resetRandomNextMusicInfo()
  settings.setting['player.togglePlayMethod'] = 'list'
  random.mockReturnValue(0)
  state.queueSession = null
  listMocks.list = ['a', 'b', 'c'].map(song)
  state.isPlay = false
  resolvedMocks.runDebounce = false
  actions.setPlayListId('old'); actions.clearTempPlayeList(); actions.clearPlayedList()
})

it('reordering the queue keeps current identity and leaves the saved playlist intact', async() => {
  actions.setPlayMusicInfo('old', listMocks.list[0], false)
  state.playInfo.playerPlayIndex = 0
  moveQueueItem('base', listMocks.list[2], -1)
  expect(listMocks.list.map(s => s.id)).toEqual(['a', 'b', 'c'])
  expect(state.playMusicInfo.musicInfo?.id).toBe('a')
  expect((await getNextPlayMusicInfo())?.musicInfo.id).toBe('c')
  await playNext()
  expect(state.playMusicInfo.musicInfo?.id).toBe('c')
})
it('playing a pending entry consumes only that occurrence and retains recommendation metadata', async() => {
  const music = song('same')
  actions.addTempPlayList([{ musicInfo: music, listId: null }, { musicInfo: music, listId: null, recommendationSessionId: 42 }])
  const selected = state.tempPlayList[1]
  await playQueueItem('pending', selected)
  expect(state.tempPlayList).toHaveLength(1)
  expect(state.playMusicInfo.recommendationSessionId).toBe(42)
  await playQueueItem('pending', selected)
  expect(state.tempPlayList).toHaveLength(1)
})
it('removing current advances without removing it from the saved playlist', async() => {
  actions.setPlayMusicInfo('old', listMocks.list[1], false)
  state.playInfo.playerPlayIndex = 1
  await removeQueueItem('base', listMocks.list[1])
  expect(state.playMusicInfo.musicInfo?.id).toBe('c')
  expect(listMocks.list.map(s => s.id)).toEqual(['a', 'b', 'c'])
})
it('clear keeps current audio but prevents old playlist or queued continuation', async() => {
  actions.setPlayMusicInfo('old', listMocks.list[0], false)
  actions.addTempPlayList([{ musicInfo: song('pending'), listId: null }])
  clearPlaybackQueue()
  expect(state.playMusicInfo.musicInfo?.id).toBe('a')
  expect(state.tempPlayList).toEqual([])
  expect(await getNextPlayMusicInfo()).toBeNull()
  expect(state.exclusiveBatch).toBe(true)
  expect(listMocks.list).toHaveLength(3)
})

it.each(['list', 'listLoop', 'singleLoop', 'random'] as const)('queue edits preserve %s mode and its next-song rules', async(mode) => {
  settings.setting['player.togglePlayMethod'] = mode
  actions.setPlayMusicInfo('old', listMocks.list[0], false)
  state.playInfo.playerPlayIndex = 0
  moveQueueItem('base', listMocks.list[2], -1)
  const next = await getNextPlayMusicInfo()
  expect(next?.musicInfo.id).toBe(mode === 'singleLoop' || mode === 'random' ? 'a' : 'c')
  expect(settings.setting['player.togglePlayMethod']).toBe(mode)
  await playNext(true)
  expect(state.playMusicInfo.musicInfo?.id).toBe(next?.musicInfo.id)
})
it('random playback consumes the previewed next song rather than drawing again', async() => {
  settings.setting['player.togglePlayMethod'] = 'random'
  actions.setPlayMusicInfo('old', listMocks.list[0], false)
  state.playInfo.playerPlayIndex = 0
  random.mockReturnValueOnce(1).mockReturnValue(2)
  expect((await getNextPlayMusicInfo())?.musicInfo.id).toBe('b')
  await playNext()
  expect(state.playMusicInfo.musicInfo?.id).toBe('b')
})
it('removing the playlist anchor during a temporary song resumes at its successor', async() => {
  actions.setPlayMusicInfo(null, song('temporary'), true)
  state.playInfo.playerPlayIndex = 0
  await removeQueueItem('base', listMocks.list[0])
  expect((await getNextPlayMusicInfo())?.musicInfo.id).toBe('b')
  await playNext()
  expect(state.playMusicInfo.musicInfo?.id).toBe('b')
})
it('pending reorder, next and removal operate on occurrences and preserve metadata', async() => {
  actions.addTempPlayList(['a', 'b', 'c'].map(id => ({ musicInfo: song(id), listId: null, recommendationSessionId: 7 })))
  const [a, b, c] = state.tempPlayList
  moveQueueItem('pending', c, -1)
  expect(state.tempPlayList).toEqual([a, c, b])
  queueItemNext('pending', b)
  expect(state.tempPlayList).toEqual([b, a, c])
  await removeQueueItem('pending', a)
  expect(state.tempPlayList).toEqual([b, c])
  expect(state.tempPlayList[0].recommendationSessionId).toBe(7)
})
it('ordinary playback explicitly resets the edited snapshot even for the same list', async() => {
  moveQueueItem('base', listMocks.list[2], -1)
  await playListById('old', 'a')
  expect(state.queueSession).toBeNull()
  expect((await getNextPlayMusicInfo())?.musicInfo.id).toBe('b')
})

it('a late next-song calculation cannot restore a removed random candidate', async() => {
  settings.setting['player.togglePlayMethod'] = 'random'
  actions.setPlayMusicInfo('old', listMocks.list[0], false)
  state.playInfo.playerPlayIndex = 0
  random.mockReturnValue(1)
  let finish!: (value: any) => void
  filter.mockImplementationOnce(async() => new Promise(resolve => { finish = resolve }))
  const pending = getNextPlayMusicInfo()
  await removeQueueItem('base', listMocks.list[1])
  finish({ filteredList: listMocks.list, playerIndex: 0 })
  expect((await pending)?.musicInfo.id).toBe('c')
  expect((await getNextPlayMusicInfo())?.musicInfo.id).toBe('c')
})
