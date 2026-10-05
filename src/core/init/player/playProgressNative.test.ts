import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { StateEvent } from '@/event/stateEvent'
import { AppEvent } from '@/event/appEvent'
const native = vi.hoisted(() => ({ id: 'a-1' as string | null, duration: 200, getDuration: vi.fn(), getPosition: vi.fn(), seek: vi.fn() }))
vi.mock('@/store/common/state', () => ({ default: { fontSize: 1, navActiveId: 'nav_search' } }))
vi.mock('@/core/common', () => ({ setNavActiveId: vi.fn() }))
vi.mock('@/utils', () => ({ arrPush: (a: unknown[], b: unknown[]) => a.push(...b), arrUnshift: (a: unknown[], b: unknown[]) => a.unshift(...b), formatPlayTime2: String }))
vi.mock('@/core/list', () => ({ updateListMusics: vi.fn(async() => {}) }))
vi.mock('@/plugins/player', () => ({ getDuration: native.getDuration, getPosition: native.getPosition, getNativeTrackId: async() => native.id, setCurrentTime: native.seek }))
vi.mock('@/utils/data', () => ({ savePlayInfo: vi.fn() }))
vi.mock('@/utils/tools', () => ({ throttleBackgroundTimer: (fn: unknown) => fn }))
vi.mock('react-native-background-timer', () => ({ default: { setInterval: () => 1, clearInterval: vi.fn() } }))
vi.mock('@/utils/nativeModules/utils', () => ({ onScreenStateChange: vi.fn() }))
vi.mock('react-native', () => ({ AppState: { addEventListener: vi.fn() } }))
let actions: typeof import('@/store/player/action').default
let state: typeof import('@/store/player/state').default
let hub: AppEvent
const song = (id: string) => ({ id, source: 'wy', name: id, singer: 'Artist', meta: {}, interval: null }) as LX.Music.MusicInfoOnline
beforeEach(async() => {
  vi.resetModules(); vi.clearAllMocks(); vi.useFakeTimers()
  native.id = 'a-1'; native.duration = 200
  native.getDuration.mockImplementation(async() => native.duration)
  native.getPosition.mockResolvedValue(10)
  hub = new (await import('@/event/appEvent')).AppEvent()
  vi.stubGlobal('app_event', hub); vi.stubGlobal('state_event', new StateEvent())
  actions = (await import('@/store/player/action')).default
  state = (await import('@/store/player/state')).default
  ;(await import('@/core/recommend/adapters/init')).initRecommendAdapters()
  ;(await import('./playProgress')).default()
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
const select = (id: string, trackId: string | null = null) => {
  actions.setPlayMusicInfo('owned', song(id))
  actions.setMusicInfo({ id })
  actions.setProgress(0, 0)
  state.resourceTrackId = trackId
  hub.musicToggled()
}
it.each([false, true])('queued A play cannot assign its native duration to B or repeated A (repeat=%s)', async(repeat) => {
  select('a', 'a-1'); hub.play()
  select('b')
  if (repeat) select('a', 'a-2')
  await vi.runAllTimersAsync()
  expect(state.progress.maxPlayTime).toBe(0)
  expect(state.progress.nowPlayTime).toBe(0)
})
it('rejects old native resource even if read starts after the new JS generation, then accepts current duration', async() => {
  const loaded = vi.fn(); hub.onSync('playerLoadeddata', loaded)
  select('b', 'b-1'); hub.play()
  await vi.runAllTimersAsync()
  expect(state.progress.maxPlayTime).toBe(0)
  expect(loaded).not.toHaveBeenCalled()
  native.id = 'b-1'; native.duration = 300
  hub.play(); await vi.runAllTimersAsync()
  expect(state.progress.maxPlayTime).toBe(300)
  expect(loaded).toHaveBeenCalledOnce()
})
it('checks native identity again after an awaited duration read', async() => {
  let finish!: (value: number) => void
  native.getDuration.mockImplementationOnce(async() => new Promise<number>(resolve => { finish = resolve }))
  select('a', 'a-1'); hub.play()
  await vi.advanceTimersByTimeAsync(0)
  native.id = 'a-2'
  finish(200); await vi.runAllTimersAsync()
  expect(state.progress.maxPlayTime).toBe(0)
})

it.each([false, true])('an old queued seek cannot change a newer selection (same object=%s)', async(repeat) => {
  select('a', 'a-1')
  const original = state.playMusicInfo.musicInfo
  hub.setProgress(55, 100)
  if (repeat) {
    actions.setPlayMusicInfo('owned', original)
    actions.setProgress(0, 0)
  } else select('b', 'b-1')
  await vi.runAllTimersAsync()
  expect(state.progress.nowPlayTime).toBe(0)
  expect(state.progress.maxPlayTime).toBe(0)
  expect(native.seek).not.toHaveBeenCalled()
})
it('a current-owner seek still sets progress and native playback position', async() => {
  select('a', 'a-1')
  hub.setProgress(20, 200)
  await vi.runAllTimersAsync()
  expect(state.progress.nowPlayTime).toBe(20)
  expect(state.progress.maxPlayTime).toBe(200)
  expect(native.seek).toHaveBeenCalledWith(20)
})
