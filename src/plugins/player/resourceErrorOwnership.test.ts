import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('react-native', () => ({ Dimensions: { get: () => ({ width: 400, height: 800 }) }, Platform: { OS: 'android', select: (v: any) => v.android }, PixelRatio: { get: () => 1, getFontScale: () => 1, roundToNearestPixel: (n: number) => n } }))
const m = vi.hoisted(() => ({ callbacks: new Map<string, any>(), register: null as any, queue: [] as any[], index: null as number | null, next: vi.fn(), refresh: vi.fn(), position: vi.fn(), nativePosition: vi.fn(async() => 123), pause: vi.fn(async() => {}), changed: null as Promise<any> | null }))
vi.mock('react-native-track-player', () => ({ default: {
 addEventListener: (name: string, fn: any) => m.callbacks.set(name, fn), registerPlaybackService: (fn: any) => { m.register = fn() },
 add: async(tracks: any[]) => { m.queue.push(...tracks) }, getQueue: async() => m.queue,
 getCurrentTrack: async() => m.index, skip: async(index: number) => { m.index = index },
 stop: async() => {}, pause: m.pause, play: async() => {}, seekTo: async() => {}, remove: async(indices: number[]) => { m.queue.splice(0, indices.length); if (m.index !== null) m.index -= indices.length },
 skipToNext: async() => { const previous = m.index; m.index = (m.index ?? -1) + 1; m.changed = m.callbacks.get('changed')({ track: previous, nextTrack: m.index }) },
 getState: async() => 0, updateMetadataForTrack: async() => {}, updateNowPlayingMetadata: async() => {}, updateNowPlayingTitles: async() => {},
 }, State: { Playing: 1 }, Event: { PlaybackError: 'error', PlaybackTrackChanged: 'changed', RemoteNext: 'next', RemotePrevious: 'prev', RemoteStop: 'stop', RemotePlay: 'play', RemotePause: 'pause', PlaybackState: 'state' }, Capability: {}, RepeatMode: {} }))
vi.mock('react-native-background-timer', () => ({ default: { setTimeout: () => 1, clearTimeout: vi.fn() } }))
vi.mock('@/plugins/player/hook', () => ({}))
vi.mock('@/utils/fs', () => ({}))
vi.mock('@/utils/tools', () => ({ toast: vi.fn(), isActive: () => false }))
vi.mock('@/config', () => ({ defaultUrl: 'placeholder.mp3' }))
vi.mock('@/utils', () => ({ arrPush: (a: any[], b: any[]) => a.push(...b), arrUnshift: (a: any[], b: any[]) => a.unshift(...b), formatPlayTime2: String }))
vi.mock('@/core/common', () => ({ exitApp: vi.fn(), setNavActiveId: vi.fn() }))
vi.mock('@/store/common/state', () => ({ default: {} }))
vi.mock('@/store/setting/state', () => ({ default: { setting: {} } }))
vi.mock('@/core/player/player', () => ({ setMusicUrl: m.refresh, playNext: m.next, playPrev: vi.fn(), play: vi.fn(), pause: vi.fn() }))
vi.mock('@/plugins/player', async() => ({ setStop: (await import('@/plugins/player/utils')).setStop, getPosition: m.nativePosition, isEmpty: () => false }))
vi.mock('@/core/player/playedList', () => ({ addPlayedList: vi.fn(), clearPlayedList: vi.fn() }))
import actions from '@/store/player/action'
import state from '@/store/player/state'
import { StateEvent } from '@/event/stateEvent'
import { AppEvent } from '@/event/appEvent'
import { playMusic } from '@/plugins/player/playList'
import service from '@/plugins/player/service'
import initPlayer from '@/core/init/player/player'
import initErrors from '@/core/init/player/playerEvent'
vi.mock('@/core/player/progress', () => ({ setNowPlayTime: m.position }))
const song = (id: string) => ({ id, name: id, singer: '', source: 'wy', meta: {} }) as any
beforeEach(async() => {
 vi.useFakeTimers(); vi.clearAllMocks(); m.index = null
 vi.stubGlobal('lx', { playerStatus: {}, isPlayedStop: false, gettingUrlId: '' })
 vi.stubGlobal('i18n', { t: String }); vi.stubGlobal('state_event', new StateEvent()); vi.stubGlobal('app_event', new AppEvent())
 service(); await m.register(); await initPlayer({} as any); initErrors()
})

const flush = async() => { for (let i=0;i<40;i++) await Promise.resolve() }
it.each([false, true])('old native error cannot affect uninstalled selection (same object=%s)', async(same) => {
 const a = song('old-installed'); const b = song('new-selected')
 actions.setPlayMusicInfo('list', a); state.resourceMusicId = a.id
 playMusic(a, 'https://old-audio', 0, state.playbackGeneration); await flush()
 expect(m.index).toBe(0); global.lx.playerTrackId = m.queue[0].id
 actions.setPlayMusicInfo('list', same ? a : b); actions.setMusicInfo({id: same ? a.id : b.id})
 expect(state.resourceTrackId).toBeNull()
 // A is still the native track while B has been selected and setup/stop is pending.
 await m.callbacks.get('error')({code:'android-io', message:'A failed'})
 await vi.runAllTimersAsync(); await flush()
 expect.soft(m.refresh).not.toHaveBeenCalled()
 expect.soft(m.position).not.toHaveBeenCalled()
 vi.useRealTimers()
})
it('installed current owner error still retries current song', async() => {
 const a = song('current'); actions.setPlayMusicInfo('list', a); actions.setMusicInfo({id:a.id}); state.resourceMusicId=a.id
 playMusic(a,'https://current',0,state.playbackGeneration); await flush(); global.lx.playerTrackId=state.resourceTrackId!
 await m.callbacks.get('error')({message:'current failed'}); await vi.runAllTimersAsync(); await flush()
 expect(m.refresh).toHaveBeenCalledWith(a,true); expect(m.position).toHaveBeenCalledWith(123); vi.useRealTimers()
})

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

const install = async(id = 'installed') => {
 const a = song(id)
 actions.setPlayMusicInfo('list', a); actions.setMusicInfo({ id }); state.resourceMusicId = a.id
 playMusic(a, 'https://audio/' + id, 0, state.playbackGeneration); await flush()
 global.lx.playerTrackId = state.resourceTrackId!
 return a
}
it.each(['selected', 'invalidated', 'replacement'])('native state cannot mutate a %s owner without installed evidence', async(mode) => {
 const a = await install()
 if (mode === 'selected') actions.setPlayMusicInfo('list', song('b'))
 else if (mode === 'invalidated') (await import('./playList')).invalidateResourceEnd()
 else playMusic(a, 'https://replacement', 0, state.playbackGeneration)
 actions.setIsPlay(false)
 await m.callbacks.get('state')({ state: 1 })
 await vi.runAllTimersAsync()
 expect(state.isPlay).toBe(false)
})
it.each(['delivery', 'position'] as const)('same-generation replacement cancels old native error at %s', async(boundary) => {
 const a = await install()
 let finish!: (position: number) => void
 if (boundary === 'position') m.nativePosition.mockImplementationOnce(async() => new Promise<number>(resolve => { finish = resolve }))
 await m.callbacks.get('error')({ code: 'old' })
 if (boundary === 'position') {
  await vi.runAllTimersAsync(); await flush()
  expect(finish).toBeTypeOf('function')
 }
 playMusic(a, 'https://replacement', 0, state.playbackGeneration)
 await flush()
 if (boundary === 'position') finish(123)
 await vi.runAllTimersAsync(); await flush()
 expect(m.position).not.toHaveBeenCalled()
 expect(m.refresh).not.toHaveBeenCalled()
})
it.each(['missing', 'failed'])('native error cannot borrow identity from a %s current track lookup', async(mode) => {
 await install()
 const native = (await import('react-native-track-player')).default
 const spy = vi.spyOn(native, 'getCurrentTrack')
 if (mode === 'missing') spy.mockResolvedValueOnce(-1)
 else spy.mockRejectedValueOnce(new Error('read failed'))
 await m.callbacks.get('error')({ code: 'old' }); await vi.runAllTimersAsync()
 expect(m.position).not.toHaveBeenCalled(); expect(m.refresh).not.toHaveBeenCalled()
 spy.mockRestore()
})

it('installed current error still performs two retries then advances normally', async() => {
 const a = await install()
 for (let i = 0; i < 3; i++) {
  await m.callbacks.get('error')({ code: 'current' })
  await vi.runAllTimersAsync(); await flush()
 }
 expect(m.refresh).toHaveBeenCalledTimes(2)
 expect(m.refresh).toHaveBeenCalledWith(a, true)
 expect(m.next).toHaveBeenCalledWith(true, 'error')
})
it('installed current native playing state still resumes the selected owner', async() => {
 await install()
 actions.setIsPlay(false)
 await m.callbacks.get('state')({ state: 1 })
 await vi.runAllTimersAsync()
 expect(state.isPlay).toBe(true)
})
