const resolvedMocks = vi.hoisted(() => ({ runDebounce: false, initialized: vi.fn(() => true), initial: vi.fn(async() => {}), permission: vi.fn(async() => {}), battery: vi.fn(), initTrack: vi.fn(), debounced: [] as Array<() => void>, timers: [] as Array<() => void>, stop: vi.fn(async() => {}), pic: vi.fn(), lyric: vi.fn(), url: vi.fn(), resource: vi.fn(), toast: vi.fn() }))
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
vi.mock('@/plugins/player', () => ({ isInitialized: resolvedMocks.initialized, initial: resolvedMocks.initial, initTrackInfo: resolvedMocks.initTrack, setStop: resolvedMocks.stop, setPause: vi.fn(), setPlay: vi.fn(), setResource: resolvedMocks.resource }))
vi.mock('@/core/music', () => ({ getMusicUrl: resolvedMocks.url, getPicPath: resolvedMocks.pic, getLyricInfo: resolvedMocks.lyric }))
vi.mock('@/utils/tools', () => ({ checkNotificationPermission: resolvedMocks.permission, checkIgnoringBatteryOptimization: resolvedMocks.battery, debounceBackgroundTimer: (fn: (info: unknown) => void) => (info: unknown) => { resolvedMocks.debounced.push(() => { fn(info) }) }, toast: resolvedMocks.toast }))
const listMocks = vi.hoisted(() => ({ list: [] as any[] }))
vi.mock('@/utils/listManage', () => ({ getListMusicSync: () => listMocks.list }))
vi.mock('@/core/player/progress', () => ({ setProgress: vi.fn() }))
vi.mock('@/core/list', () => ({ addListMusics: vi.fn(), removeListMusics: vi.fn() }))
vi.mock('@/core/dislikeList', () => ({ addDislikeInfo: vi.fn() }))
vi.mock('@/store/dislikeList', () => ({ state: { dislikeInfo: { names: new Set(), musicNames: new Set(), singerNames: new Set() } } }))
vi.mock('react-native-background-timer', () => ({ default: { setTimeout: (fn: () => void) => { resolvedMocks.timers.push(fn); return resolvedMocks.timers.length }, clearTimeout: vi.fn() } }))
import settings from '@/store/setting/state'
import actions from '@/store/player/action'
import state from '@/store/player/state'
import { setMusicUrl, playNext, getNextPlayMusicInfo, playQueueItem, moveQueueItem, removeQueueItem, resetRandomNextMusicInfo, playMusicInfoNow, stop, playPrev, clearPlaybackQueue } from '@/core/player/player'
vi.mock('@/plugins/player/playList', () => ({ delayUpdateMusicInfo: vi.fn() }))
import initializePlayerEvents from '@/core/init/player/player'
const song = (id: string) => ({ id, source: 'wy', name: id, singer: '', interval: null, meta: {} }) as LX.Music.MusicInfoOnline
beforeEach(() => {
  vi.stubGlobal('state_event', new StateEvent()); vi.stubGlobal('app_event', new AppEvent())
  vi.stubGlobal('lx', { isPlayedStop: false, restorePlayInfo: null })
  vi.stubGlobal('i18n', { t: (key: string) => key })
  vi.clearAllMocks()
  resolvedMocks.stop.mockResolvedValue()
  resolvedMocks.initialized.mockReturnValue(true)
  resolvedMocks.initial.mockImplementation(async() => { resolvedMocks.initialized.mockReturnValue(true) })
  resolvedMocks.permission.mockResolvedValue()
  resolvedMocks.debounced = []
  resolvedMocks.timers = []
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


afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

it.each(['queue', 'next', 'same'])('older queue selection cannot pause newer %s playback', async(route) => {
  await initializePlayerEvents(settings.setting)
  let finish!: () => void
  resolvedMocks.stop.mockImplementationOnce(async() => new Promise<void>(resolve => { finish = resolve }))
  const oldSelection = playQueueItem('base', listMocks.list[0])
  if (route === 'same') await playQueueItem('base', listMocks.list[0])
  else if (route === 'queue') await playQueueItem('base', listMocks.list[1])
  else await playNext()
  global.app_event.play()
  expect(state.isPlay).toBe(true)
  const paused = vi.spyOn(global.app_event, 'pause')
  finish()
  await oldSelection
  expect(state.playMusicInfo.musicInfo?.id).toBe(route === 'same' ? 'a' : 'b')
  expect(state.isPlay).toBe(true)
  expect(paused).not.toHaveBeenCalled()
})

it.each(['permission', 'initialization'] as const)('a superseded selection does not continue after delayed %s', async(stage) => {
  await initializePlayerEvents(settings.setting)
  resolvedMocks.initialized.mockReturnValue(false)
  let finish!: () => void
  const pending = stage === 'permission' ? resolvedMocks.permission : resolvedMocks.initial
  pending.mockImplementationOnce(async() => new Promise<void>(resolve => { finish = resolve }))
  const oldSelection = playQueueItem('base', listMocks.list[0])
  await vi.waitFor(() => { expect(finish).toBeTypeOf('function') })
  await playQueueItem('base', listMocks.list[1])
  global.app_event.play()
  const paused = vi.spyOn(global.app_event, 'pause')
  const nativeStops = resolvedMocks.stop.mock.calls.length
  finish()
  await oldSelection
  expect(state.playMusicInfo.musicInfo?.id).toBe('b')
  expect(state.isPlay).toBe(true)
  expect(paused).not.toHaveBeenCalled()
  expect(resolvedMocks.stop).toHaveBeenCalledTimes(nativeStops)
})
it('a scheduled playback callback cannot adopt the generation of a same-object reselection', async() => {
  const a = listMocks.list[0]
  await playQueueItem('base', a)
  const oldCallback = resolvedMocks.debounced[0]
  let finish!: () => void
  resolvedMocks.stop.mockImplementationOnce(async() => new Promise<void>(resolve => { finish = resolve }))
  const selectingAgain = playQueueItem('base', a)
  oldCallback()
  expect(resolvedMocks.url).not.toHaveBeenCalled()
  expect(resolvedMocks.pic).not.toHaveBeenCalled()
  finish()
  await selectingAgain
})
it('restore progress, artwork and lyric callbacks cannot overwrite a same-object reselection', async() => {
  vi.useFakeTimers()
  global.lx.restorePlayInfo = { listId: 'old', index: 0, time: 12, maxTime: 100 }
  let cover!: (value: string) => void
  let lyric!: (value: any) => void
  resolvedMocks.pic.mockImplementationOnce(async() => new Promise(resolve => { cover = resolve }))
  resolvedMocks.lyric.mockImplementationOnce(async() => new Promise(resolve => { lyric = resolve }))
  await playQueueItem('base', listMocks.list[0])
  await playQueueItem('base', listMocks.list[0])
  const progress = vi.spyOn(global.app_event, 'setProgress')
  cover('obsolete-cover')
  lyric({ lyric: 'obsolete-lyric', rawlrcInfo: { lyric: 'obsolete-lyric' } })
  await vi.runAllTimersAsync()
  expect(progress).not.toHaveBeenCalled()
  expect(state.musicInfo.pic).not.toBe('obsolete-cover')
  expect(state.musicInfo.lrc).not.toBe('obsolete-lyric')
})

it('an old load/error timer cannot advance a newer selection while its native stop is pending', async() => {
  resolvedMocks.url.mockImplementationOnce(async() => new Promise<string>(() => {}))
  await playQueueItem('base', listMocks.list[0])
  resolvedMocks.debounced[0]()
  const oldTimer = resolvedMocks.timers[0]
  let finish!: () => void
  resolvedMocks.stop.mockImplementationOnce(async() => new Promise<void>(resolve => { finish = resolve }))
  const selecting = playQueueItem('base', listMocks.list[1])
  oldTimer()
  await new Promise(resolve => setTimeout(resolve, 0))
  finish()
  await selecting
  expect(state.playMusicInfo.musicInfo?.id).toBe('b')
})
it('same-ID reselection starts its own URL request even if the old request finishes during native stop', async() => {
  let finishUrl!: (url: string) => void
  resolvedMocks.url.mockImplementationOnce(async() => new Promise<string>(resolve => { finishUrl = resolve }))
  const a = listMocks.list[0]
  await playQueueItem('base', a)
  resolvedMocks.debounced[0]()
  let finishStop!: () => void
  resolvedMocks.stop.mockImplementationOnce(async() => new Promise<void>(resolve => { finishStop = resolve }))
  const selecting = playQueueItem('base', a)
  finishUrl('obsolete-url')
  await new Promise(resolve => setTimeout(resolve, 0))
  finishStop()
  await selecting
  resolvedMocks.debounced.at(-1)!()
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(resolvedMocks.url).toHaveBeenCalledTimes(2)
  expect(resolvedMocks.resource).not.toHaveBeenCalledWith(a, 'obsolete-url', expect.anything())
})
it('an unchanged restore owner still receives saved progress and metadata', async() => {
  vi.useFakeTimers()
  settings.setting['player.isSavePlayTime'] = true
  global.lx.restorePlayInfo = { listId: 'old', index: 0, time: 12, maxTime: 100 }
  const progress = vi.spyOn(global.app_event, 'setProgress')
  await playQueueItem('base', listMocks.list[0])
  await vi.runAllTimersAsync()
  expect(progress).toHaveBeenCalledWith(12, 100)
  expect(resolvedMocks.initTrack).toHaveBeenCalledOnce()
  expect(state.musicInfo.pic).toBe('cover')
  expect(global.lx.restorePlayInfo).toBeNull()
})

it('a revoked resource operation cannot publish a pending URL, while a fresh request can', async() => {
  const music = listMocks.list[0] as LX.Music.MusicInfoOnline
  actions.setPlayMusicInfo('old', music)
  let finish!: (url: string) => void
  resolvedMocks.url.mockImplementationOnce(async() => new Promise<string>(resolve => { finish = resolve }))
  setMusicUrl(music)
  ++state.resourceOperationId // The actual stop adapter revokes this operation synchronously.
  finish('old-url')
  for (let i = 0; i < 20; i++) await Promise.resolve()
  expect(resolvedMocks.resource).not.toHaveBeenCalled()
  setMusicUrl(music)
  for (let i = 0; i < 20; i++) await Promise.resolve()
  expect(resolvedMocks.resource).toHaveBeenCalledWith(music, 'url', state.progress.nowPlayTime)
})
it.each(['native-wait', 'cleanup-timer'] as const)('old core stop cannot stop a new resource begun during %s', async(boundary) => {
  vi.useFakeTimers()
  await initializePlayerEvents(settings.setting)
  const music = listMocks.list[0] as LX.Music.MusicInfoOnline
  actions.setPlayMusicInfo('old', music)
  let finish!: () => void
  resolvedMocks.stop.mockImplementationOnce(async() => {
    ++state.resourceOperationId
    if (boundary === 'native-wait') await new Promise<void>(resolve => { finish = resolve })
  })
  const emitted = vi.spyOn(global.app_event, 'stop')
  const stopping = stop()
  if (boundary === 'cleanup-timer') await stopping
  ++state.resourceOperationId
  if (boundary === 'native-wait') { finish(); await stopping }
  await vi.runAllTimersAsync()
  expect(emitted).not.toHaveBeenCalled()
})
it('core completed stop projects status without starting a second native stop', async() => {
  vi.useFakeTimers()
  await initializePlayerEvents(settings.setting)
  actions.setPlayMusicInfo('old', listMocks.list[0])
  resolvedMocks.stop.mockImplementation(async() => { ++state.resourceOperationId })
  await stop()
  await vi.runAllTimersAsync()
  expect(resolvedMocks.stop).toHaveBeenCalledOnce()
})
it.each(['permission', 'native-stop', 'debounce'] as const)('stop revocation cancels pending play intent at %s', async(boundary) => {
  let finish!: () => void
  if (boundary === 'permission') {
    resolvedMocks.initialized.mockReturnValue(false)
    resolvedMocks.permission.mockImplementationOnce(async() => new Promise<void>(resolve => { finish = resolve }))
  } else if (boundary === 'native-stop') {
    resolvedMocks.stop.mockImplementationOnce(async() => {
      ++state.resourceOperationId
      await new Promise<void>(resolve => { finish = resolve })
    })
  }
  const selecting = playQueueItem('base', listMocks.list[0])
  if (boundary === 'debounce') await selecting
  ++state.resourceOperationId
  if (boundary !== 'debounce') { finish(); await selecting }
  for (const run of resolvedMocks.debounced.splice(0)) run()
  for (let i = 0; i < 20; i++) await Promise.resolve()
  expect(resolvedMocks.url).not.toHaveBeenCalled()
  if (boundary === 'permission') expect(resolvedMocks.initial).not.toHaveBeenCalled()
})
