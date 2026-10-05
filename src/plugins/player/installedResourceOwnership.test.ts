import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import actions from '@/store/player/action'
import state from '@/store/player/state'
import { StateEvent } from '@/event/stateEvent'
import { AppEvent } from '@/event/appEvent'
import { playMusic } from '@/plugins/player/playList'
import { setStop } from '@/plugins/player/utils'
import service from '@/plugins/player/service'
import initPlayer from '@/core/init/player/player'
vi.mock('react-native', () => ({ Dimensions: { get: () => ({ width: 400, height: 800 }) }, Platform: { OS: 'android', select: (v: any) => v.android }, PixelRatio: { get: () => 1, getFontScale: () => 1, roundToNearestPixel: (n: number) => n } }))
const m = vi.hoisted(() => ({ timers: [] as Array<() => void>, callbacks: new Map<string, any>(), register: null as any, queue: [] as any[], index: null as number | null, next: vi.fn(), pause: vi.fn(async() => {}), changed: null as Promise<any> | null }))
vi.mock('react-native-track-player', () => ({
  default: {
    addEventListener: (name: string, fn: any) => m.callbacks.set(name, fn),
    registerPlaybackService: (fn: any) => { m.register = fn() },
    add: async(tracks: any[]) => { m.queue.push(...tracks) },
    getQueue: async() => m.queue,
    getCurrentTrack: async() => m.index,
    skip: async(index: number) => { m.index = index },
    stop: async() => {},
    pause: m.pause,
    play: async() => {},
    seekTo: async() => {},
    remove: async(indices: number[]) => { m.queue.splice(0, indices.length); if (m.index !== null) m.index -= indices.length },
    skipToNext: async() => { const previous = m.index; m.index = (m.index ?? -1) + 1; m.changed = m.callbacks.get('changed')({ track: previous, nextTrack: m.index }) },
    getState: async() => 0,
    updateMetadataForTrack: async() => {},
    updateNowPlayingMetadata: async() => {},
    updateNowPlayingTitles: async() => {},
  },
  State: { Playing: 1 },
  Event: { PlaybackTrackChanged: 'changed' },
  Capability: {},
  RepeatMode: {},
}))
vi.mock('react-native-background-timer', () => ({ default: { setTimeout: (fn: () => void) => { m.timers.push(fn); return m.timers.length }, clearTimeout: vi.fn() } }))
vi.mock('@/plugins/player/hook', () => ({}))
vi.mock('@/utils/fs', () => ({}))
vi.mock('@/utils/tools', () => ({ toast: vi.fn() }))
vi.mock('@/config', () => ({ defaultUrl: 'placeholder.mp3' }))
vi.mock('@/utils', () => ({ arrPush: (a: any[], b: any[]) => a.push(...b), arrUnshift: (a: any[], b: any[]) => a.unshift(...b), formatPlayTime2: String }))
vi.mock('@/core/common', () => ({ exitApp: vi.fn(), setNavActiveId: vi.fn() }))
vi.mock('@/store/common/state', () => ({ default: {} }))
vi.mock('@/store/setting/state', () => ({ default: { setting: {} } }))
vi.mock('@/core/player/player', () => ({ playNext: m.next, playPrev: vi.fn(), play: vi.fn(), pause: vi.fn() }))
vi.mock('@/plugins/player', async() => ({ setStop: (await import('@/plugins/player/utils')).setStop }))
vi.mock('@/core/player/playedList', () => ({ addPlayedList: vi.fn(), clearPlayedList: vi.fn() }))
// Real resource installer, stop adapter, registered service and AppEvent consumers.
// Only native bridge operations and the final queue transition are mocked.
const song = (id: string) => ({ id, name: id, singer: '', source: 'wy', meta: {} }) as any
beforeEach(async() => {
  vi.useFakeTimers(); vi.clearAllMocks(); m.index = null; m.timers = []
  vi.stubGlobal('lx', { playerStatus: {}, isPlayedStop: false, gettingUrlId: '' })
  vi.stubGlobal('i18n', { t: String }); vi.stubGlobal('state_event', new StateEvent()); vi.stubGlobal('app_event', new AppEvent())
  service(); await m.register(); await initPlayer({} as any)
})
it.each([false, true])('manual selection stop cannot end the new owner (same object=%s)', async(sameObject) => {
  const a = song('a'); const b = song('b')
  actions.setPlayMusicInfo('list', a)
  state.resourceMusicId = a.id
  playMusic(a, 'https://audio', 0, state.playbackGeneration)
  for (let i = 0; i < 20; i++) await Promise.resolve()
  expect(m.queue).toHaveLength(2)
  expect(m.index).toBe(0)
  global.lx.playerTrackId = m.queue[0].id
  // This is the real selection mutation performed before handlePlay invokes the real setStop.
  actions.setPlayMusicInfo('list', sameObject ? a : b)
  await setStop(); await m.changed; await vi.runAllTimersAsync()
  expect(m.next).not.toHaveBeenCalled()
  vi.useRealTimers()
})

it('an actual installed track natural end still advances normally', async() => {
  const a = song('control')
  actions.setPlayMusicInfo('list', a); state.resourceMusicId = a.id
  playMusic(a, 'https://control', 0, state.playbackGeneration)
  for (let i = 0; i < 20; i++) await Promise.resolve()
  // The actual internal list survives tests; use the native queue's final placeholder index.
  m.index = m.queue.length - 1; global.lx.playerTrackId = m.queue[m.queue.length - 2].id
  await m.callbacks.get('changed')({ track: 0, nextTrack: 1 })
  await vi.runAllTimersAsync()
  expect(m.next).toHaveBeenCalledWith(true)
  vi.useRealTimers()
})

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
const install = async(id = 'installed') => {
  const music = song(id)
  actions.setPlayMusicInfo('list', music)
  state.resourceMusicId = music.id
  playMusic(music, 'https://audio/' + id, 0, state.playbackGeneration)
  for (let i = 0; i < 30; i++) await Promise.resolve()
  global.lx.playerTrackId = m.queue[m.index!].id
  return music
}
it('an explicit native stop under an unchanged selection is not natural ending', async() => {
  await install()
  await setStop(); await m.changed; await vi.runAllTimersAsync()
  expect(m.next).not.toHaveBeenCalled()
})
it.each(['cleared', 'replacement', 'no-resource'])('a known old placeholder cannot end a %s resource', async(mode) => {
  const music = await install()
  const oldPlaceholder = m.queue.length - 1
  if (mode === 'no-resource') actions.setPlayMusicInfo('list', music)
  else state.resourceTrackId = mode === 'cleared' ? null : 'replacement-resource'
  m.index = oldPlaceholder
  await m.callbacks.get('changed')({ track: 0 })
  await vi.runAllTimersAsync()
  expect(m.pause).not.toHaveBeenCalled()
  expect(m.next).not.toHaveBeenCalled()
})
it('same-generation replacement rejects an old placeholder but accepts its own paired end', async() => {
  const music = await install()
  const oldTracks = [...m.queue]
  playMusic(music, 'https://replacement', 0, state.playbackGeneration)
  for (let i = 0; i < 30; i++) await Promise.resolve()
  const { isCurrentResourceEnd } = await import('./playList')
  expect(isCurrentResourceEnd(oldTracks[1].id, state.playbackGeneration)).toBe(false)
  expect(isCurrentResourceEnd(m.queue[m.queue.length - 1].id, state.playbackGeneration)).toBe(true)
  m.index = m.queue.length - 1
  await m.callbacks.get('changed')({ track: 0 })
  await vi.runAllTimersAsync()
  expect(m.next).toHaveBeenCalledWith(true)
})

it.each(['lookup', 'pause'] as const)('an installed end spanning a new selection during %s cannot advance it', async(boundary) => {
  await install()
  m.index = m.queue.length - 1
  const native = (await import('react-native-track-player')).default
  let finish!: () => void
  let spy: ReturnType<typeof vi.spyOn> | undefined
  if (boundary === 'lookup') {
    const oldIndex = m.index
    spy = vi.spyOn(native, 'getCurrentTrack').mockImplementationOnce(async() => new Promise<number>(resolve => { finish = () => { resolve(oldIndex) } }))
  } else m.pause.mockImplementationOnce(async() => new Promise<void>(resolve => { finish = resolve }))
  const pending = m.callbacks.get('changed')({ track: 0 })
  for (let i = 0; i < 5; i++) await Promise.resolve()
  actions.setPlayMusicInfo('list', song('new'))
  finish()
  await pending; await vi.runAllTimersAsync()
  expect(m.next).not.toHaveBeenCalled()
  spy?.mockRestore()
})
it('resource invalidation while an end pause is pending cancels its effects', async() => {
  await install()
  m.index = m.queue.length - 1
  let finish!: () => void
  m.pause.mockImplementationOnce(async() => new Promise<void>(resolve => { finish = resolve }))
  const pending = m.callbacks.get('changed')({ track: 0 })
  for (let i = 0; i < 5; i++) await Promise.resolve()
  const { invalidateResourceEnd } = await import('./playList')
  invalidateResourceEnd()
  finish(); await pending; await vi.runAllTimersAsync()
  expect(m.next).not.toHaveBeenCalled()
})
it('synchronous end observer selecting a new owner prevents the remaining native end effects', async() => {
  await install()
  m.index = m.queue.length - 1
  global.app_event.onSync('playerPause', () => { actions.setPlayMusicInfo('list', song('new')) })
  await m.callbacks.get('changed')({ track: 0 })
  await vi.runAllTimersAsync()
  expect(m.next).not.toHaveBeenCalled()
})

it('synchronous invalidation of the installed pair cancels remaining end effects', async() => {
  await install()
  m.index = m.queue.length - 1
  const { invalidateResourceEnd } = await import('./playList')
  global.app_event.onSync('playerPause', invalidateResourceEnd)
  await m.callbacks.get('changed')({ track: 0 })
  await vi.runAllTimersAsync()
  expect(m.next).not.toHaveBeenCalled()
})

it.each(['missing', 'failed'] as const)('installed resource does not end on %s native lookup', async(mode) => {
  await install()
  const native = (await import('react-native-track-player')).default
  const spy = vi.spyOn(native, 'getCurrentTrack')
  if (mode === 'missing') spy.mockResolvedValueOnce(-1)
  else spy.mockRejectedValueOnce(new Error('lookup failed'))
  await m.callbacks.get('changed')({ track: 0 })
  await vi.runAllTimersAsync()
  expect(m.next).not.toHaveBeenCalled()
  spy.mockRestore()
})

const flush = async() => { for (let i = 0; i < 50; i++) await Promise.resolve() }
it('stop must not skip a same-generation resource whose install completes while stop waits', async() => {
 const native = (await import('react-native-track-player')).default
 const a = song('in-flight-install')
 actions.setPlayMusicInfo('list', a); state.resourceMusicId = a.id
 let finishSkip!: () => void
 const skip = vi.spyOn(native, 'skip').mockImplementationOnce(async(index) => new Promise<void>(resolve => { finishSkip = () => { const previous = m.index; m.index = index; m.changed = m.callbacks.get('changed')({ track: previous, nextTrack: index }); resolve() } }))
 playMusic(a, 'https://in-flight', 0, state.playbackGeneration)
 await flush()
 expect(finishSkip).toBeTypeOf('function')
 const pendingAudioId = state.resourceTrackId
 let finishStop!: () => void
 const stop = vi.spyOn(native, 'stop').mockImplementationOnce(async() => new Promise<void>(resolve => { finishStop = resolve }))
 const skipNext = vi.spyOn(native, 'skipToNext')
 global.app_event.stop()
 expect(finishStop).toBeTypeOf('function')
 finishSkip(); await flush()
 expect(state.resourceTrackId).toBe(pendingAudioId)
 expect(global.lx.playerTrackId).toBe(pendingAudioId)
 finishStop(); await flush(); await m.changed; await vi.runAllTimersAsync()
 skip.mockRestore(); stop.mockRestore(); skipNext.mockRestore()
 expect(m.next).not.toHaveBeenCalled()
 vi.useRealTimers()
})

it.each(['add', 'getQueue', 'skip'] as const)('stop cancels installation pending at %s and permits a new explicit install', async(boundary) => {
 const native = (await import('react-native-track-player')).default
 const music = song('cancel')
 actions.setPlayMusicInfo('list', music); state.resourceMusicId = music.id
 let finish!: () => void
 const original = native[boundary] as (...args: any[]) => Promise<any>
 const spy = vi.spyOn(native, boundary).mockImplementationOnce((async(...args: any[]) => {
  const value = await original(...args)
  return new Promise(resolve => { finish = () => { resolve(value) } })
 }) as any)
 const play = vi.spyOn(native, 'play')
 playMusic(music, 'https://old', 0, state.playbackGeneration)
 await flush(); expect(finish).toBeTypeOf('function')
 await setStop()
 finish(); await flush()
 expect(play).not.toHaveBeenCalled()
 const { getInstalledResource } = await import('./playList')
 expect(getInstalledResource()).toBeNull()
 spy.mockRestore()
 playMusic(music, 'https://new', 0, state.playbackGeneration)
 await flush()
 expect(play).toHaveBeenCalledOnce()
 expect(getInstalledResource()?.audioId).toBe(state.resourceTrackId)
 play.mockRestore()
})
it('stop cancels resource debounce without preventing a later explicit request', async() => {
 const native = (await import('react-native-track-player')).default
 const { setResource } = await import('./utils')
 const music = song('debounced')
 actions.setPlayMusicInfo('list', music)
 setResource(music, 'https://first')
 await flush()
 const play = vi.spyOn(native, 'play')
 setResource(music, 'https://queued')
 await setStop()
 for (const timer of m.timers.splice(0)) timer()
 await flush()
 expect(play).not.toHaveBeenCalled()
 setResource(music, 'https://fresh')
 await flush()
 expect(play).toHaveBeenCalledOnce()
 play.mockRestore()
})
it('a stale direct install request cannot revoke the current installed resource', async() => {
  const music = await install()
  const { getInstalledResource } = await import('./playList')
  const resource = getInstalledResource()
  expect(resource).not.toBeNull()
  playMusic(music, 'https://stale', 0, state.playbackGeneration - 1)
  await flush()
  expect(getInstalledResource()).toBe(resource)
})
