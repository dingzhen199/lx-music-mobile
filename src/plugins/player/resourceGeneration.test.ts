import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const native = vi.hoisted(() => ({ index: vi.fn(), add: vi.fn(), skip: vi.fn(), queue: [] as any[] }))
vi.mock('react-native-track-player', () => ({ default: {
  getCurrentTrack: native.index, add: native.add, skip: native.skip,
  getQueue: async() => native.queue, play: vi.fn(async() => {}), pause: vi.fn(async() => {}), seekTo: vi.fn(async() => {}), remove: vi.fn(async() => {}),
}, State: {} }))
vi.mock('react-native-background-timer', () => ({ default: { setTimeout, clearTimeout } }))
vi.mock('@/config', () => ({ defaultUrl: 'placeholder' }))
vi.mock('@/utils', () => ({ arrPush: vi.fn(), arrUnshift: vi.fn(), formatPlayTime2: String }))
let state: typeof import('@/store/player/state').default
let actions: typeof import('@/store/player/action').default
let play: typeof import('./playList').playMusic
const song = (id: string) => ({ id, source: 'wy', name: id, singer: 'Artist', meta: {}, interval: null }) as LX.Music.MusicInfoOnline
beforeEach(async() => {
  vi.resetModules(); vi.clearAllMocks(); vi.useFakeTimers()
  vi.stubGlobal('lx', { restorePlayInfo: null })
  vi.stubGlobal('state_event', { playMusicInfoChanged: vi.fn() })
  native.queue = []
  native.index.mockResolvedValue(null)
  native.add.mockImplementation(async(items) => { native.queue.push(...items) })
  native.skip.mockResolvedValue(undefined)
  state = (await import('@/store/player/state')).default
  actions = (await import('@/store/player/action')).default
  play = (await import('./playList')).playMusic
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
it('a stale install never submits native tracks after a new selection epoch', async() => {
  let finish!: (value: number | null) => void
  native.index.mockImplementationOnce(async() => new Promise<number | null>(resolve => { finish = resolve }))
  const a = song('a'); actions.setPlayMusicInfo('owned', a); state.resourceMusicId = 'a'
  play(a, 'https://audio.test/a', 0, state.playbackGeneration)
  await vi.advanceTimersByTimeAsync(0)
  actions.setPlayMusicInfo('owned', song('b'))
  finish(null); await vi.advanceTimersByTimeAsync(0)
  expect(native.add).not.toHaveBeenCalled()
  expect(state.resourceTrackId).toBeNull()
})
it('a valid install publishes the exact generated native identity for duration guards', async() => {
  const a = song('a'); actions.setPlayMusicInfo('owned', a); state.resourceMusicId = 'a'
  play(a, 'https://audio.test/a', 0, state.playbackGeneration)
  await vi.advanceTimersByTimeAsync(0)
  expect(native.add).toHaveBeenCalledOnce()
  expect(state.resourceTrackId).toBe(native.queue[0].id)
  expect(state.resourceTrackId).toContain('a__//')
  expect(native.skip).toHaveBeenCalledWith(0)
})
