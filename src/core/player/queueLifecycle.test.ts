const resolvedMocks = vi.hoisted(() => ({ runDebounce: false, stop: vi.fn(async() => {}), pic: vi.fn(), lyric: vi.fn(), url: vi.fn(), resource: vi.fn(), toast: vi.fn() }))
vi.mock('@/store/common/state', () => ({ default: { fontSize: 1, navActiveId: 'nav_search' } }))
vi.mock('@/core/common', () => ({ setNavActiveId: vi.fn() }))
vi.mock('react-native', () => ({ Dimensions: { get: () => ({ width: 400, height: 800 }) }, Platform: { OS: 'android', select: (v: any) => v.android }, PixelRatio: { get: () => 1, getFontScale: () => 1, roundToNearestPixel: (n: number) => n } }))
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { StateEvent } from '@/event/stateEvent'
import { AppEvent } from '@/event/appEvent'
vi.mock('@/store/setting/state', () => ({ default: { setting: { 'player.togglePlayMethod': 'list' } } }))
const random = vi.hoisted(() => vi.fn(() => 0))
vi.mock('@/utils/common', () => ({ getRandom: random }))
vi.mock('@/utils', () => ({ arrPush: (a: unknown[], b: unknown[]) => a.push(...b), arrUnshift: (a: unknown[], b: unknown[]) => a.unshift(...b), formatPlayTime2: String }))
vi.mock('@/plugins/player', () => ({ isInitialized: () => true, setStop: resolvedMocks.stop, setPause: vi.fn(), setPlay: vi.fn(), setResource: resolvedMocks.resource }))
vi.mock('@/core/music', () => ({ getMusicUrl: resolvedMocks.url, getPicPath: resolvedMocks.pic, getLyricInfo: resolvedMocks.lyric }))
vi.mock('@/utils/tools', () => ({ debounceBackgroundTimer: (fn: (info: unknown) => void) => (info: unknown) => { if (resolvedMocks.runDebounce) fn(info) }, toast: resolvedMocks.toast }))
const listMocks = vi.hoisted(() => ({ list: [] as any[] }))
vi.mock('@/utils/listManage', () => ({ getListMusicSync: () => listMocks.list }))
vi.mock('@/core/player/progress', () => ({ setProgress: vi.fn() }))
vi.mock('@/core/list', () => ({ addListMusics: vi.fn(), removeListMusics: vi.fn() }))
vi.mock('@/core/dislikeList', () => ({ addDislikeInfo: vi.fn() }))
vi.mock('@/store/dislikeList', () => ({ state: { dislikeInfo: { names: new Set(), musicNames: new Set(), singerNames: new Set() } } }))
vi.mock('react-native-background-timer', () => ({ default: { setTimeout: () => 1, clearTimeout: vi.fn() } }))
import settings from '@/store/setting/state'
import actions from '@/store/player/action'
import state from '@/store/player/state'
import { playNext, getNextPlayMusicInfo, playQueueItem, moveQueueItem, removeQueueItem, resetRandomNextMusicInfo, playMusicInfoNow, stop, playPrev, clearPlaybackQueue } from './player'
const song = (id: string) => ({ id, source: 'wy', name: id, singer: '', interval: null, meta: {} }) as LX.Music.MusicInfoOnline
beforeEach(() => {
  vi.stubGlobal('state_event', new StateEvent()); vi.stubGlobal('app_event', new AppEvent())
  vi.stubGlobal('lx', { isPlayedStop: false, restorePlayInfo: null })
  vi.stubGlobal('i18n', { t: (key: string) => key })
  vi.clearAllMocks()
  resolvedMocks.stop.mockResolvedValue()
  resetRandomNextMusicInfo()
  settings.setting['player.togglePlayMethod'] = 'list'
  random.mockReset().mockReturnValue(0)
  state.queueSession = null
  listMocks.list = ['a', 'b', 'c'].map(song)
  state.isPlay = false
  resolvedMocks.runDebounce = false
  actions.setPlayListId('old'); actions.clearTempPlayeList(); actions.clearPlayedList()
})


afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

it.each(['new', 'only'])('an old sole-entry removal cannot clear a newer %s playback owner', async(id) => {
  vi.useFakeTimers()
  const only = song('only')
  listMocks.list = [only]
  actions.setPlayMusicInfo('old', only, false)
  state.playInfo.playerPlayIndex = 0
  const stopped = vi.spyOn(global.app_event, 'stop')
  let finish!: () => void
  resolvedMocks.stop.mockImplementationOnce(async() => new Promise<void>(resolve => { finish = resolve }))
  const removing = removeQueueItem('base', only)
  playMusicInfoNow(song(id))
  await Promise.resolve()
  finish()
  await removing
  await vi.runAllTimersAsync()
  expect(state.playMusicInfo.musicInfo?.id).toBe(id)
  expect(stopped).not.toHaveBeenCalled()
})
it('the delayed stop event cannot pause a newer selection after native stop resolves', async() => {
  vi.useFakeTimers()
  actions.setPlayMusicInfo('old', song('old'), false)
  const stopped = vi.spyOn(global.app_event, 'stop')
  await stop()
  playMusicInfoNow(song('new'))
  await vi.runAllTimersAsync()
  expect(stopped).not.toHaveBeenCalled()
  expect(state.playMusicInfo.musicInfo?.id).toBe('new')
})
it('ordinary sole-entry removal still clears playback and emits stop once', async() => {
  vi.useFakeTimers()
  const only = song('only')
  listMocks.list = [only]
  actions.setPlayMusicInfo('old', only, false)
  const stopped = vi.spyOn(global.app_event, 'stop')
  await removeQueueItem('base', only)
  await vi.runAllTimersAsync()
  expect(state.playMusicInfo.musicInfo).toBeNull()
  expect(stopped).toHaveBeenCalledOnce()
})
it.each(['cleared', 'deleted'])('session selection and real filtering survive a %s backing list', async(action) => {
  const [a, b, c] = listMocks.list
  actions.setPlayMusicInfo('old', a, false)
  state.playInfo.playerPlayIndex = 0
  moveQueueItem('base', c, -1)
  if (action === 'cleared') listMocks.list.splice(0)
  else listMocks.list = []
  await playQueueItem('base', c)
  expect(state.playInfo.playIndex).toBe(-1)
  expect(state.playInfo.playerPlayIndex).toBe(1)
  expect((await getNextPlayMusicInfo())?.musicInfo).toBe(b)
  await playNext(true)
  expect(state.playMusicInfo.musicInfo).toBe(b)
})
it('concurrent random preview and preloading calls share the same candidate', async() => {
  settings.setting['player.togglePlayMethod'] = 'random'
  actions.setPlayMusicInfo('old', listMocks.list[0], false)
  state.playInfo.playerPlayIndex = 0
  random.mockReturnValueOnce(1).mockReturnValueOnce(2)
  const [preview, preload] = await Promise.all([getNextPlayMusicInfo(), getNextPlayMusicInfo()])
  expect(preview?.musicInfo.id).toBe('b')
  expect(preload).toBe(preview)
  expect(random).toHaveBeenCalledOnce()
  await playNext()
  expect(state.playMusicInfo.musicInfo).toBe(preview?.musicInfo)
})

it('the delayed exhausted-queue cleanup also leaves a newer selection alone', async() => {
  vi.useFakeTimers()
  actions.setPlayListId(null)
  actions.setPlayMusicInfo(null, song('old'), true)
  const stopped = vi.spyOn(global.app_event, 'stop')
  await playNext()
  playMusicInfoNow(song('new'))
  await vi.runAllTimersAsync()
  expect(state.playMusicInfo.musicInfo?.id).toBe('new')
  expect(stopped).not.toHaveBeenCalled()
})

it.each([['next', playNext], ['previous', playPrev]] as const)('%s cannot override a queue clear across real filtering', async(_direction, navigate) => {
  vi.useFakeTimers()
  actions.setPlayMusicInfo('old', listMocks.list[1], false)
  state.playInfo.playerPlayIndex = 1
  const changing = navigate()
  clearPlaybackQueue()
  await changing
  await vi.runAllTimersAsync()
  expect(state.playMusicInfo.musicInfo?.id).toBe('b')
  expect(state.playInfo.playerListId).toBeNull()
})
it.each([['next', playNext], ['previous', playPrev]] as const)('%s cannot override a new selection across real filtering', async(_direction, navigate) => {
  actions.setPlayMusicInfo('old', listMocks.list[1], false)
  state.playInfo.playerPlayIndex = 1
  const changing = navigate()
  playMusicInfoNow(song('new'))
  await changing
  expect(state.playMusicInfo.musicInfo?.id).toBe('new')
})
it.each([['next', playNext, 2], ['previous', playPrev, 0]] as const)('%s cannot resurrect a removed queue entry across real filtering', async(_direction, navigate, index) => {
  actions.setPlayMusicInfo('old', listMocks.list[1], false)
  state.playInfo.playerPlayIndex = 1
  const removed = listMocks.list[index]
  const changing = navigate()
  await removeQueueItem('base', removed)
  await changing
  expect(state.playMusicInfo.musicInfo).not.toBe(removed)
})

it('a play-next insertion wins over an in-flight next-song filter', async() => {
  actions.setPlayMusicInfo('old', listMocks.list[0], false)
  state.playInfo.playerPlayIndex = 0
  const changing = playNext()
  actions.addTempPlayList([{ musicInfo: song('inserted'), listId: null, isTop: true }])
  await changing
  expect(state.playMusicInfo.musicInfo?.id).toBe('inserted')
  expect(state.tempPlayList).toEqual([])
})
it('an in-flight preview observes newly queued priority songs', async() => {
  actions.setPlayMusicInfo('old', listMocks.list[0], false)
  state.playInfo.playerPlayIndex = 0
  const preview = getNextPlayMusicInfo()
  actions.addTempPlayList([{ musicInfo: song('inserted'), listId: null, isTop: true }])
  expect((await preview)?.musicInfo.id).toBe('inserted')
})
it('removing the sole current entry honors songs queued while native stop is pending', async() => {
  vi.useFakeTimers()
  const only = song('only')
  listMocks.list = [only]
  actions.setPlayMusicInfo('old', only, false)
  let finish!: () => void
  resolvedMocks.stop.mockImplementationOnce(async() => new Promise<void>(resolve => { finish = resolve }))
  const removing = removeQueueItem('base', only)
  actions.addTempPlayList([{ musicInfo: song('inserted'), listId: null, recommendationSessionId: 7 }])
  finish()
  await removing
  await vi.runAllTimersAsync()
  expect(state.playMusicInfo.musicInfo?.id).toBe('inserted')
  expect(state.playMusicInfo.recommendationSessionId).toBe(7)
  expect(state.tempPlayList).toEqual([])
})
import { addTempPlayList } from '@/core/player/tempPlayList'
vi.mock('@/plugins/player/playList', () => ({ delayUpdateMusicInfo: vi.fn() }))
import initializePlaybackEvents from '@/core/init/player/player'
it.each(['during-stop', 'after-stop-before-cleanup'])('review: enqueue %s at exhausted stop starts queued music rather than stranding it', async(timing) => {
  vi.useFakeTimers()
  actions.setPlayListId(null)
  actions.setPlayMusicInfo(null, song('old'), true)
  let finish!: () => void
  resolvedMocks.stop.mockImplementationOnce(async() => new Promise<void>(resolve => { finish = resolve }))
  state.exclusiveBatch = true
  const toggled = vi.spyOn(global.app_event, 'musicToggled')
  const ending = playNext(true)
  const queued = song('queued')
  if (timing === 'during-stop') addTempPlayList([{ musicInfo: queued, listId: null, recommendationSessionId: 71, alternativeMusicInfos: [song('alternative')] }, { musicInfo: song('remaining'), listId: null }])
  finish()
  await ending
  if (timing === 'after-stop-before-cleanup') addTempPlayList([{ musicInfo: queued, listId: null, recommendationSessionId: 71, alternativeMusicInfos: [song('alternative')] }, { musicInfo: song('remaining'), listId: null }])
  await vi.runAllTimersAsync()
  expect(state.playMusicInfo.musicInfo).toBe(queued)
  expect(state.playMusicInfo.recommendationSessionId).toBe(71)
  expect(state.playMusicInfo.alternativeMusicInfos?.[0].id).toBe('alternative')
  expect(state.tempPlayList.map(item => item.musicInfo.id)).toEqual(['remaining'])
  expect(state.exclusiveBatch).toBe(true)
  expect(toggled).toHaveBeenCalledWith('ended')
})
it.each([0, 1])('review: a queued old ended event cannot skip new queue selection %s', async(index) => {
  vi.useFakeTimers()
  await initializePlaybackEvents(settings.setting as LX.AppSetting)
  await playQueueItem('base', listMocks.list[0])
  global.app_event.playerEnded()
  await playQueueItem('base', listMocks.list[index])
  await vi.runAllTimersAsync()
  expect(state.playMusicInfo.musicInfo).toBe(listMocks.list[index])
})

it.each(['list', 'listLoop', 'singleLoop', 'random'] as const)('a current-owner ended event respects %s mode', async(mode) => {
  vi.useFakeTimers()
  settings.setting['player.togglePlayMethod'] = mode
  await initializePlaybackEvents(settings.setting as LX.AppSetting)
  await playQueueItem('base', listMocks.list[0])
  global.app_event.playerEnded()
  await vi.runAllTimersAsync()
  expect(state.playMusicInfo.musicInfo).toBe(listMocks.list[mode === 'singleLoop' ? 0 : 1])
})

it('ordinary exhausted cleanup still clears current when no pending item arrives', async() => {
  vi.useFakeTimers()
  actions.setPlayListId(null)
  actions.setPlayMusicInfo(null, song('last'), true)
  state.exclusiveBatch = true
  const stopped = vi.spyOn(global.app_event, 'stop')
  await playNext(true)
  await vi.runAllTimersAsync()
  expect(state.playMusicInfo.musicInfo).toBeNull()
  expect(stopped).toHaveBeenCalledOnce()
  expect(state.exclusiveBatch).toBe(true)
})
