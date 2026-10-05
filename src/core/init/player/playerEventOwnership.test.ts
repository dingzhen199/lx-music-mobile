const resolvedMocks = vi.hoisted(() => ({ runDebounce: false, initialized: vi.fn(() => true), initial: vi.fn(async() => {}), permission: vi.fn(async() => {}), battery: vi.fn(), initTrack: vi.fn(), debounced: [] as Array<() => void>, timers: [] as Array<() => void>, delays: [] as number[], position: vi.fn(), active: vi.fn(() => true), stop: vi.fn(async() => {}), pic: vi.fn(), lyric: vi.fn(), url: vi.fn(), resource: vi.fn(), toast: vi.fn() }))
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
vi.mock('@/plugins/player', () => ({ isInitialized: resolvedMocks.initialized, initial: resolvedMocks.initial, initTrackInfo: resolvedMocks.initTrack, setStop: resolvedMocks.stop, setPause: vi.fn(), setPlay: vi.fn(), setResource: resolvedMocks.resource, getPosition: resolvedMocks.position, isEmpty: () => false }))
vi.mock('@/core/music', () => ({ getMusicUrl: resolvedMocks.url, getPicPath: resolvedMocks.pic, getLyricInfo: resolvedMocks.lyric }))
vi.mock('@/utils/tools', () => ({ isActive: resolvedMocks.active, checkNotificationPermission: resolvedMocks.permission, checkIgnoringBatteryOptimization: resolvedMocks.battery, debounceBackgroundTimer: (fn: (info: unknown) => void) => (info: unknown) => { resolvedMocks.debounced.push(() => { fn(info) }) }, toast: resolvedMocks.toast }))
const listMocks = vi.hoisted(() => ({ list: [] as any[] }))
vi.mock('@/utils/listManage', () => ({ getListMusicSync: () => listMocks.list }))

vi.mock('@/core/list', () => ({ addListMusics: vi.fn(), removeListMusics: vi.fn() }))
vi.mock('@/core/dislikeList', () => ({ addDislikeInfo: vi.fn() }))
vi.mock('@/store/dislikeList', () => ({ state: { dislikeInfo: { names: new Set(), musicNames: new Set(), singerNames: new Set() } } }))
vi.mock('react-native-background-timer', () => ({ default: { setTimeout: (fn: () => void, delay: number) => { resolvedMocks.timers.push(fn); resolvedMocks.delays.push(delay); return resolvedMocks.timers.length }, clearTimeout: vi.fn() } }))
import settings from '@/store/setting/state'
import actions from '@/store/player/action'
import state from '@/store/player/state'
import { playNext, getNextPlayMusicInfo, playQueueItem, moveQueueItem, removeQueueItem, resetRandomNextMusicInfo, playMusicInfoNow, stop, playPrev, clearPlaybackQueue } from '@/core/player/player'
vi.mock('@/plugins/player/playList', () => ({ delayUpdateMusicInfo: vi.fn() }))
import initializePlayerEvents from '@/core/init/player/player'
const song = (id: string) => ({ id, source: 'wy', name: id, singer: '', interval: null, meta: {} }) as LX.Music.MusicInfoOnline
let appEvent: AppEvent
beforeEach(() => {
  appEvent = new AppEvent()
  vi.stubGlobal('state_event', new StateEvent()); vi.stubGlobal('app_event', appEvent)
  vi.stubGlobal('lx', { isPlayedStop: false, restorePlayInfo: null })
  vi.stubGlobal('i18n', { t: (key: string) => key })
  vi.clearAllMocks()
  resolvedMocks.stop.mockResolvedValue()
  resolvedMocks.initialized.mockReturnValue(true)
  resolvedMocks.initial.mockImplementation(async() => { resolvedMocks.initialized.mockReturnValue(true) })
  resolvedMocks.permission.mockResolvedValue()
  resolvedMocks.debounced = []
  resolvedMocks.timers = []
  resolvedMocks.delays = []
  resolvedMocks.position.mockReset()
  resolvedMocks.active.mockReturnValue(true)
  resolvedMocks.url.mockResolvedValue('url')
  resolvedMocks.pic.mockResolvedValue('cover')
  resolvedMocks.lyric.mockResolvedValue({ lyric: '', rawlrcInfo: { lyric: '' } })
  resetRandomNextMusicInfo()
  settings.setting['player.togglePlayMethod'] = 'list'
  random.mockReturnValue(0)
  state.queueSession = null
  listMocks.list = ['a', 'b', 'c'].map(song)
  state.isPlay = false
  resolvedMocks.runDebounce = false
  actions.setPlayListId('old'); actions.clearTempPlayeList(); actions.clearPlayedList()
})


afterEach(async() => { await new Promise(resolve => setImmediate(resolve)); vi.useRealTimers(); vi.unstubAllGlobals() })


import initializeNativeEvents from '@/core/init/player/playerEvent'
it.each([0, 1])('old native error progress cannot seek newer queue selection %s', async(index) => {
  initializeNativeEvents()
  await playQueueItem('base', listMocks.list[0])
  let finish!: (n: number) => void
  resolvedMocks.position.mockImplementationOnce(async() => new Promise<number>(resolve => { finish = resolve }))
  global.app_event.playerError()
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  await playQueueItem('base', listMocks.list[index])
  state.progress.nowPlayTime = 0
  finish(55)
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(state.playMusicInfo.musicInfo?.id).toBe(index ? 'b' : 'a')
  resolvedMocks.debounced.at(-1)!()
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(resolvedMocks.resource).toHaveBeenLastCalledWith(listMocks.list[index], 'url', 0)
})
it('old exhausted-error timer cannot advance a new queue selection', async() => {
  initializeNativeEvents()
  await playQueueItem('base', listMocks.list[0])
  await new Promise(resolve => setImmediate(resolve))
  resolvedMocks.position.mockResolvedValue(0)
  const error = appEvent.listeners.get('playerError')![0]
  error()
  await new Promise(resolve => setImmediate(resolve))
  error()
  await new Promise(resolve => setImmediate(resolve))
  let deferred!: () => void
  const timer = vi.spyOn(global, 'setTimeout').mockImplementationOnce(((fn: () => void) => { deferred = fn; return 100 }) as any)
  error()
  timer.mockRestore()
  await playQueueItem('base', listMocks.list[1])
  await new Promise(resolve => setImmediate(resolve))
  deferred()
  resolvedMocks.timers.at(-1)!()
  await new Promise(resolve => setImmediate(resolve))
  expect(state.playMusicInfo.musicInfo?.id).toBe('b')
})

const flush = async() => new Promise<void>(resolve => setImmediate(resolve))
const emit = (event: string) => { appEvent.listeners.get(event)![0]() }
const startErrors = async() => {
  initializeNativeEvents()
  await playQueueItem('base', listMocks.list[0])
  await flush()
  resolvedMocks.position.mockResolvedValue(0)
  emit('playerError'); await flush()
  emit('playerError'); await flush()
}
const deferExhaustion = () => {
  let deferred!: () => void
  const timer = vi.spyOn(global, 'setTimeout').mockImplementationOnce(((fn: () => void) => { deferred = fn; return 100 }) as any)
  emit('playerError')
  timer.mockRestore()
  return deferred
}
it('the unchanged error owner retries at its own saved position', async() => {
  initializeNativeEvents()
  await playQueueItem('base', listMocks.list[0]); await flush()
  resolvedMocks.position.mockResolvedValue(55)
  emit('playerError'); await flush()
  expect(resolvedMocks.resource).toHaveBeenLastCalledWith(listMocks.list[0], 'url', 55)
  expect(state.statusText).toBe('player__refresh_url')
  emit('playerError'); await flush()
  expect(resolvedMocks.position).toHaveBeenCalledTimes(2)
  expect(resolvedMocks.url).toHaveBeenCalledTimes(2)
})
it('unchanged error exhaustion still advances after the existing five-second delay', async() => {
  await startErrors()
  const deferred = deferExhaustion()
  expect(state.playMusicInfo.musicInfo?.id).toBe('a')
  deferred()
  expect(resolvedMocks.delays.at(-1)).toBe(5000)
  resolvedMocks.timers.at(-1)!(); await flush()
  expect(state.playMusicInfo.musicInfo?.id).toBe('b')
})
it.each(['playerPlaying', 'playerEmptied'])('%s cancels an outer error timer before it can install a new delay', async(event) => {
  await startErrors()
  const deferred = deferExhaustion()
  const timersBefore = resolvedMocks.timers.length
  emit(event)
  deferred()
  expect(resolvedMocks.timers).toHaveLength(timersBefore)
  expect(state.playMusicInfo.musicInfo?.id).toBe('a')
})
it.each(['playerPlaying', 'playerEmptied'])('%s invalidates an already queued error-delay callback', async(event) => {
  await startErrors()
  deferExhaustion()()
  const delayed = resolvedMocks.timers.at(-1)!
  emit(event)
  delayed(); await flush()
  expect(state.playMusicInfo.musicInfo?.id).toBe('a')
})
it.each([0, 1])('an old loading timeout cannot refresh or skip reselected owner %s', async(index) => {
  initializeNativeEvents()
  await playQueueItem('base', listMocks.list[0]); await flush()
  state.isPlay = true
  emit('playerLoadstart')
  const loading = resolvedMocks.timers.at(-1)!
  expect(resolvedMocks.delays.at(-1)).toBe(25000)
  await playQueueItem('base', listMocks.list[index]); await flush()
  loading(); await flush()
  expect(resolvedMocks.url).not.toHaveBeenCalled()
  expect(state.playMusicInfo.musicInfo?.id).toBe(index ? 'b' : 'a')
})
it.each(['playerPlaying', 'playerEmptied'])('%s invalidates a canceled loading callback for the same owner', async(event) => {
  initializeNativeEvents()
  await playQueueItem('base', listMocks.list[0]); await flush()
  state.isPlay = true
  emit('playerLoadstart')
  const loading = resolvedMocks.timers.at(-1)!
  emit(event)
  loading(); await flush()
  expect(resolvedMocks.url).not.toHaveBeenCalled()
})
it('the current loading owner still refreshes once, then advances on another timeout', async() => {
  initializeNativeEvents()
  await playQueueItem('base', listMocks.list[0]); await flush()
  state.isPlay = true
  emit('playerLoadstart'); resolvedMocks.timers.at(-1)!(); await flush()
  expect(resolvedMocks.url).toHaveBeenCalledOnce()
  emit('playerLoadstart'); resolvedMocks.timers.at(-1)!(); await flush()
  expect(state.playMusicInfo.musicInfo?.id).toBe('b')
})
it('a new selection receives its own retry budget before deferred UI notifications run', async() => {
  await startErrors()
  await playQueueItem('base', listMocks.list[1])
  emit('playerError'); await flush()
  expect(resolvedMocks.position).toHaveBeenCalledTimes(3)
  expect(resolvedMocks.resource).toHaveBeenLastCalledWith(listMocks.list[1], 'url', 0)
})

it('native position rejection still permits the unchanged owner to refresh without an unhandled rejection', async() => {
  initializeNativeEvents()
  await playQueueItem('base', listMocks.list[0]); await flush()
  resolvedMocks.position.mockRejectedValueOnce(new Error('native position unavailable'))
  emit('playerError'); await flush()
  expect(resolvedMocks.url).toHaveBeenCalledOnce()
  expect(resolvedMocks.resource).toHaveBeenLastCalledWith(listMocks.list[0], 'url', 0)
  expect(state.statusText).toBe('player__refresh_url')
})
it.each([['outer', 0], ['outer', 1], ['inner', 0], ['inner', 1]] as const)('stale %s exhausted-error timer cannot affect reselected owner %s', async(stage, index) => {
  await startErrors()
  const outer = deferExhaustion()
  let oldCallback = outer
  if (stage === 'inner') { outer(); oldCallback = resolvedMocks.timers.at(-1)! }
  await playQueueItem('base', listMocks.list[index]); await flush()
  actions.setStatusText('new-owner-status')
  global.lx.isPlayedStop = true
  oldCallback(); await flush()
  expect(state.playMusicInfo.musicInfo?.id).toBe(index ? 'b' : 'a')
  expect(state.statusText).toBe('new-owner-status')
})
it('an unchanged owner that has stopped is not advanced by its existing error timer', async() => {
  await startErrors()
  deferExhaustion()()
  global.lx.isPlayedStop = true
  resolvedMocks.timers.at(-1)!(); await flush()
  expect(state.playMusicInfo.musicInfo?.id).toBe('a')
  expect(state.statusText).toBe('')
})
it('inactive-app error exhaustion retains immediate next-song recovery', async() => {
  await startErrors()
  resolvedMocks.active.mockReturnValue(false)
  emit('playerError'); await flush()
  expect(state.playMusicInfo.musicInfo?.id).toBe('b')
})
it.each(['playerError', 'playerLoadstart', 'playerWaiting', 'playerPlaying', 'playerEmptied'] as const)('queued %s delivery cannot adopt a later playback generation', async(event) => {
  initializeNativeEvents()
  await playQueueItem('base', listMocks.list[0]); await flush()
  resolvedMocks.position.mockResolvedValue(99)
  global.app_event[event]()
  await playQueueItem('base', listMocks.list[1])
  state.isPlay = true
  emit('playerLoadstart')
  const currentLoading = resolvedMocks.timers.at(-1)!
  actions.setStatusText('new-owner-status')
  await flush()
  expect(state.statusText).toBe('new-owner-status')
  expect(resolvedMocks.position).not.toHaveBeenCalled()
  expect(resolvedMocks.url).not.toHaveBeenCalled()
  currentLoading(); await flush()
  expect(resolvedMocks.url).toHaveBeenCalledOnce()
})
