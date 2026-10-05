import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ resource: null as any, listeners: new Map<string, (...args: any[]) => any>(), register: null as any, currentTrack: vi.fn(), pause: vi.fn(), next: vi.fn(), previous: vi.fn(), play: vi.fn(), corePause: vi.fn(), exit: vi.fn() }))
const events = vi.hoisted(() => ({ RemotePlay: 'remotePlay', RemotePause: 'remotePause', RemoteNext: 'remoteNext', RemotePrevious: 'remotePrevious', RemoteStop: 'remoteStop', RemoteSeek: 'remoteSeek', PlaybackError: 'error', PlaybackState: 'state', PlaybackTrackChanged: 'changed' }))
const states = vi.hoisted(() => ({ None: 0, Ready: 1, Playing: 2, Paused: 3, Stopped: 4, Buffering: 5, Connecting: 6 }))
vi.mock('react-native-track-player', () => ({ default: { addEventListener: (event: string, listener: (...args: any[]) => any) => mocks.listeners.set(event, listener), registerPlaybackService: (factory: any) => { mocks.register = factory() }, pause: mocks.pause }, State: states, Event: events }))
vi.mock('@/plugins/player/utils', () => ({ isTempId: () => false, isEmpty: () => !global.lx.playerTrackId || /\/\/default$/.test(global.lx.playerTrackId), setStop: async() => {} }))
vi.mock('@/plugins/player/playList', () => ({ getCurrentTrackId: mocks.currentTrack, getInstalledResource: () => mocks.resource, isCurrentResourceEnd: (id: string) => id === 'a__//default', delayUpdateMusicInfo: vi.fn() }))
vi.mock('@/core/common', () => ({ exitApp: mocks.exit, setNavActiveId: vi.fn() }))
vi.mock('@/utils', () => ({ arrPush: (a: any[], b: any[]) => a.push(...b), arrUnshift: (a: any[], b: any[]) => a.unshift(...b), formatPlayTime2: String }))
vi.mock('@/store/common/state', () => ({ default: {} }))
vi.mock('@/core/player/player', () => ({ pause: mocks.corePause, play: mocks.play, playNext: mocks.next, playPrev: mocks.previous }))
vi.mock('@/plugins/player', () => ({ setStop: async() => {} }))
vi.mock('@/store/setting/state', () => ({ default: { setting: {} } }))
vi.mock('@/core/player/playedList', () => ({ addPlayedList: vi.fn(), clearPlayedList: vi.fn() }))
import actions from '@/store/player/action'
import state from '@/store/player/state'
import { StateEvent } from '@/event/stateEvent'
import { AppEvent } from '@/event/appEvent'
import service from './service'
import initPlayer from '@/core/init/player/player'
let hub: AppEvent
let a: LX.Music.MusicInfoOnline
const song = (id: string) => ({ id, source: 'wy', name: id, singer: '', interval: null, meta: {} }) as LX.Music.MusicInfoOnline
const select = (music: LX.Music.MusicInfoOnline, resource = `${music.id}-native`) => {
  actions.setPlayMusicInfo('list', music)
  actions.setMusicInfo({ id: music.id, name: music.name })
  actions.setIsPlay(true)
  state.resourceTrackId = resource
  mocks.resource = { generation: state.playbackGeneration, operationId: state.resourceOperationId, audioId: resource, placeholderId: 'a__//default' }
  global.lx.playerTrackId = resource
}
beforeEach(async() => {
  vi.clearAllMocks(); vi.useFakeTimers()
  mocks.currentTrack.mockReset().mockResolvedValue('a__//default')
  mocks.pause.mockReset().mockResolvedValue(undefined)
  mocks.next.mockResolvedValue(undefined); mocks.previous.mockResolvedValue(undefined); mocks.corePause.mockResolvedValue(undefined)
  vi.stubGlobal('lx', { playerStatus: {}, isPlayedStop: false, gettingUrlId: '' })
  vi.stubGlobal('i18n', { t: String })
  hub = new AppEvent()
  vi.stubGlobal('app_event', hub); vi.stubGlobal('state_event', new StateEvent())
  a = song('a'); select(a)
  await initPlayer({} as LX.AppSetting)
  service(); await mocks.register()
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
const changed = (info = { track: 0 }) => mocks.listeners.get(events.PlaybackTrackChanged)!(info)
it.each([['track-read', false], ['track-read', true], ['pause-wait', false], ['pause-wait', true]] as const)('stale %s completion cannot affect a newer selection (same object=%s)', async(boundary, same) => {
  let finish!: (id?: string) => void
  if (boundary === 'track-read') mocks.currentTrack.mockImplementationOnce(async() => new Promise(resolve => { finish = resolve }))
  else mocks.pause.mockImplementationOnce(async() => new Promise<void>(resolve => { finish = () => { resolve() } }))
  const pending = changed()
  if (boundary === 'pause-wait') await Promise.resolve()
  select(same ? a : song('b'))
  const currentId = global.lx.playerTrackId
  finish('a__//default'); await pending; await vi.runAllTimersAsync()
  if (boundary === 'track-read') expect(mocks.pause).not.toHaveBeenCalled()
  expect(global.lx.playerTrackId).toBe(currentId)
  expect(mocks.next).not.toHaveBeenCalled()
  expect(state.isPlay).toBe(true)
})
it.each(['track-read', 'pause-wait'] as const)('same-generation resource replacement invalidates %s continuation', async(boundary) => {
  let finish!: (id?: string) => void
  if (boundary === 'track-read') mocks.currentTrack.mockImplementationOnce(async() => new Promise(resolve => { finish = resolve }))
  else mocks.pause.mockImplementationOnce(async() => new Promise<void>(resolve => { finish = () => { resolve() } }))
  const pending = changed()
  if (boundary === 'pause-wait') await Promise.resolve()
  state.resourceTrackId = 'replacement-native'
  global.lx.playerTrackId = 'replacement-native'
  finish('a__//default'); await pending; await vi.runAllTimersAsync()
  expect(global.lx.playerTrackId).toBe('replacement-native')
  expect(mocks.next).not.toHaveBeenCalled()
})
it('unchanged natural end passes the original generation and advances', async() => {
  const generation = state.playbackGeneration
  const ended = vi.spyOn(hub, 'playerEnded')
  await changed(); await vi.runAllTimersAsync()
  expect(mocks.pause).toHaveBeenCalledOnce()
  expect(ended).toHaveBeenCalledWith(generation, expect.any(Function))
  expect(mocks.next).toHaveBeenCalledWith(true)
})
it('initial native track assignment updates identity without claiming natural end', async() => {
  await changed({ track: null as any }); await vi.runAllTimersAsync()
  expect(global.lx.playerTrackId).toBe('a__//default')
  expect(mocks.pause).not.toHaveBeenCalled()
  expect(mocks.next).not.toHaveBeenCalled()
})
it('a known non-placeholder native identity is not a natural end', async() => {
  mocks.currentTrack.mockResolvedValue('a-native')
  await changed(); await vi.runAllTimersAsync()
  expect(mocks.pause).not.toHaveBeenCalled()
  expect(mocks.next).not.toHaveBeenCalled()
})
it.each(['missing', 'rejected'] as const)('unknown native identity (%s) must not be guessed as an ended song', async(mode) => {
  if (mode === 'missing') mocks.currentTrack.mockResolvedValue(undefined)
  else mocks.currentTrack.mockRejectedValue(new Error('native read unavailable'))
  await expect(changed()).resolves.toBeUndefined()
  await vi.runAllTimersAsync()
  expect(global.lx.playerTrackId).toBe('a-native')
  expect(mocks.pause).not.toHaveBeenCalled()
  expect(mocks.next).not.toHaveBeenCalled()
})
it('failed native pause does not publish an ended transition', async() => {
  mocks.pause.mockRejectedValue(new Error('pause failed'))
  await expect(changed()).resolves.toBeUndefined()
  await vi.runAllTimersAsync()
  expect(mocks.next).not.toHaveBeenCalled()
})
it('owner change by a synchronous raw-event observer cancels remaining end effects', async() => {
  hub.onSync('playerPause', () => { select(song('b')) })
  await changed(); await vi.runAllTimersAsync()
  expect(state.isPlay).toBe(true)
  expect(mocks.next).not.toHaveBeenCalled()
})
it('a stale track read cannot trigger a timeout exit for the newer owner', async() => {
  let finish!: (id: string) => void
  mocks.currentTrack.mockImplementationOnce(async() => new Promise(resolve => { finish = resolve }))
  const pending = changed()
  select(song('b')); global.lx.isPlayedStop = true
  finish('a__//default'); await pending
  expect(mocks.exit).not.toHaveBeenCalled()
})
it('current-owner timeout exit remains available', async() => {
  global.lx.isPlayedStop = true
  await changed()
  expect(mocks.exit).toHaveBeenCalledWith('Timeout Exit')
})
it('native error stops after a synchronous observer selects a newer owner', async() => {
  const nativeError = vi.fn()
  hub.onSync('error', () => { select(song('b')) })
  hub.onSync('playerError', nativeError)
  mocks.currentTrack.mockResolvedValue('a-native')
  await mocks.listeners.get(events.PlaybackError)!({ code: 'test' })
  await vi.runAllTimersAsync()
  expect(nativeError).not.toHaveBeenCalled()
  expect(state.isPlay).toBe(true)
})
it.each([['Playing', 'playerPlaying', 'play'], ['Paused', 'playerPause', 'pause'], ['Buffering', 'pause', 'playerWaiting']] as const)('native %s stops secondary effects after synchronous owner replacement', async(status, first, second) => {
  const later = vi.fn()
  hub.onSync(first, () => { select(song('b')) })
  hub.onSync(second, later)
  mocks.currentTrack.mockResolvedValue('a-native')
  await mocks.listeners.get(events.PlaybackState)!({ state: states[status] })
  await vi.runAllTimersAsync()
  expect(later).not.toHaveBeenCalled()
})
it.each([['Playing', 'play'], ['Paused', 'pause'], ['Buffering', 'playerWaiting'], ['Connecting', 'playerLoadstart']] as const)('current native %s forwards the captured generation', async(status, event) => {
  const observed = vi.fn(); hub.onSync(event, observed)
  const generation = state.playbackGeneration
  mocks.currentTrack.mockResolvedValue('a-native')
  await mocks.listeners.get(events.PlaybackState)!({ state: states[status] })
  expect(observed).toHaveBeenCalledWith(generation)
})
it.each([['RemotePlay', 'play'], ['RemotePause', 'corePause'], ['RemoteNext', 'next'], ['RemotePrevious', 'previous']] as const)('%s retains current-user command behavior', async(event, effect) => {
  await mocks.listeners.get(events[event])!()
  expect(mocks[effect]).toHaveBeenCalledOnce()
})
it('remote seek and stop retain their explicit current-user semantics', async() => {
  const seek = vi.fn(); hub.onSync('setProgress', seek)
  const generation = state.playbackGeneration
  await mocks.listeners.get(events.RemoteSeek)!({ position: 12 })
  expect(seek).toHaveBeenCalledWith(12, undefined, generation)
  await mocks.listeners.get(events.RemoteStop)!()
  expect(mocks.exit).toHaveBeenCalledWith('Remote Stop')
})
it('explicit stale AppEvent generations cannot reach synchronous playback observers', () => {
  const generation = state.playbackGeneration
  select(song('b'))
  const stop = vi.fn(); hub.onSync('stop', stop)
  ;(hub.stop as (generation: number) => void)(generation)
  expect(stop).not.toHaveBeenCalled()
  expect(state.isPlay).toBe(true)
})
it.each([['Playing', 'play', false], ['Paused', 'pause', true]] as const)('native %s cannot mutate a newer owner through later synchronous consumers', async(status, event, playing) => {
  hub = new AppEvent()
  vi.stubGlobal('app_event', hub)
  hub.onSync(event, () => { select(song('b')); actions.setIsPlay(playing) })
  await initPlayer({} as LX.AppSetting)
  mocks.currentTrack.mockResolvedValue('a-native')
  await mocks.listeners.get(events.PlaybackState)!({ state: states[status] })
  await vi.runAllTimersAsync()
  expect(state.playMusicInfo.musicInfo?.id).toBe('b')
  expect(state.isPlay).toBe(playing)
})
