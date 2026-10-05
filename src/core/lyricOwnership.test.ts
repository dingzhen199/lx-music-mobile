import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import state from '@/store/player/state'
import { play, setLyric, setPlaybackRate, toggleTranslation, toggleRoma } from './lyric'
const mocks = vi.hoisted(() => ({ position: vi.fn(), play: vi.fn(), desktopLyric: vi.fn(), titles: vi.fn(), rate: vi.fn(), translation: vi.fn(), roma: vi.fn() }))
vi.mock('@/plugins/lyric', () => ({ init: async() => {}, play: mocks.play, pause: vi.fn(), setLyric: vi.fn(), setPlaybackRate: vi.fn(), toggleTranslation: vi.fn(), toggleRoma: vi.fn() }))
vi.mock('@/core/desktopLyric', () => ({ playDesktopLyric: vi.fn(), pauseDesktopLyric: vi.fn(), setDesktopLyric: mocks.desktopLyric, setDesktopLyricPlaybackRate: mocks.rate, toggleDesktopLyricTranslation: mocks.translation, toggleDesktopLyricRoma: mocks.roma }))
vi.mock('@/plugins/player', () => ({ getPosition: mocks.position }))
vi.mock('@/plugins/player/utils', () => ({ updateNowPlayingTitles: mocks.titles }))
vi.mock('@/store/setting/state', () => ({ default: { setting: { 'player.isShowBluetoothFullLyric': true } } }))
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers()
  ++state.playbackGeneration
  state.isPlay = true
  state.musicInfo = { ...state.musicInfo, id: 'a', name: 'a', lrc: 'A lyric', tlrc: null, rlrc: null }
  mocks.position.mockResolvedValue(12)
  mocks.desktopLyric.mockResolvedValue(undefined)
  mocks.rate.mockResolvedValue(undefined); mocks.translation.mockResolvedValue(undefined); mocks.roma.mockResolvedValue(undefined)
})
afterEach(() => { vi.useRealTimers() })
it('a stale lyric position read cannot restart the newer owner lyric clock', async() => {
  let finish!: (value: number) => void
  mocks.position.mockImplementationOnce(async() => new Promise(resolve => { finish = resolve }))
  play()
  ++state.playbackGeneration
  finish(55)
  await vi.runAllTimersAsync()
  expect(mocks.play).not.toHaveBeenCalled()
})
it('old desktop lyric completion cannot overwrite newer Bluetooth lyrics', async() => {
  let finish!: () => void
  mocks.desktopLyric.mockImplementationOnce(async() => new Promise<void>(resolve => { finish = resolve }))
  const old = setLyric()
  ++state.playbackGeneration
  state.musicInfo.lrc = 'B lyric'
  await setLyric()
  finish(); await old; await vi.runAllTimersAsync()
  expect(mocks.titles).toHaveBeenLastCalledWith({ lyric: 'B lyric' })
})
it.each([['rate', setPlaybackRate, 1.2], ['translation', toggleTranslation, true], ['roma', toggleRoma, true]] as const)('late %s completion cannot restart lyrics for a new owner', async(key, action, value) => {
  let finish!: () => void
  mocks[key].mockImplementationOnce(async() => new Promise<void>(resolve => { finish = resolve }))
  const changing = (action as (value: any) => Promise<void>)(value)
  ++state.playbackGeneration
  finish(); await changing; await vi.runAllTimersAsync()
  expect(mocks.position).not.toHaveBeenCalled()
})
it('current lyric owner still publishes full lyrics and starts at the native position', async() => {
  await setLyric(); await vi.runAllTimersAsync()
  expect(mocks.titles).toHaveBeenCalledWith({ lyric: 'A lyric' })
  expect(mocks.play).toHaveBeenCalledWith(12000)
})
