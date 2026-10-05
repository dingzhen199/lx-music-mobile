import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import native from './nativeMock.mjs'
import state from '@/store/player/state'
import { initTrackInfo, playMusic, updateMetaData, delayUpdateMusicInfo } from '@/plugins/player/playList'
vi.mock('@/config', () => ({ defaultUrl: 'placeholder' }))
vi.mock('@/store/setting/state', () => ({ default: { setting: {} } }))
const timers = vi.hoisted(() => [])
vi.mock('react-native-background-timer', () => ({ default: { setTimeout: fn => { timers.push(fn); return timers.length }, clearTimeout: vi.fn() } }))
let queue
const song = { id: 'a', source: 'wy', name: 'a', singer: '', interval: null, meta: {} }
beforeEach(() => {
  queue = []
  state.playbackGeneration = 1
  state.resourceMusicId = song.id
  state.musicInfo = { ...state.musicInfo, id: 'a', name: 'a' }
  vi.stubGlobal('lx', { restorePlayInfo: null })
  native.add = vi.fn(async(tracks) => { queue.push(...tracks) })
  native.getQueue = vi.fn(async() => queue)
  native.skip = vi.fn(async() => {})
  native.getCurrentTrack = vi.fn(async() => null)
  native.getState = vi.fn(async() => 0)
  native.updateNowPlayingMetadata = vi.fn(async() => {})
  native.play = vi.fn(async() => {})
  native.remove = vi.fn(async() => {})
})
afterEach(async() => { for (const timer of timers.splice(0)) timer(); await new Promise(resolve => setTimeout(resolve, 0)); vi.unstubAllGlobals() })
it.each(['add', 'getQueue', 'skip'])('restore initialization cannot continue after stale %s completion', async(boundary) => {
  let finish
  native[boundary].mockImplementationOnce(async(value) => new Promise(resolve => {
    if (boundary === 'add') queue.push(...value)
    finish = () => resolve(boundary === 'getQueue' ? queue : undefined)
  }))
  const restoring = initTrackInfo(song, state.musicInfo)
  await vi.waitFor(() => { expect(finish).toBeTypeOf('function') })
  ++state.playbackGeneration
  finish()
  await restoring
  for (const timer of timers.splice(0)) timer()
  await new Promise(resolve => setTimeout(resolve, 0))
  if (boundary === 'add') expect(native.getQueue).not.toHaveBeenCalled()
  else if (boundary === 'getQueue') expect(native.skip).not.toHaveBeenCalled()
  else expect(native.getState).not.toHaveBeenCalled()
})
it('a stale native play completion does not prune the newer native queue', async() => {
  native.add.mockImplementation(async(tracks) => { queue.push(...tracks, { id: 'extra' }) })
  let finish
  native.play.mockImplementationOnce(async() => new Promise(resolve => { finish = resolve }))
  playMusic(song, 'https://audio.test/a', 0, state.playbackGeneration)
  await vi.waitFor(() => { expect(finish).toBeTypeOf('function') })
  ++state.playbackGeneration
  finish()
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(native.remove).not.toHaveBeenCalled()
})

it('metadata lookup completion cannot publish data for an old playback generation', async() => {
  let finish
  native.getState.mockImplementationOnce(async() => new Promise(resolve => { finish = resolve }))
  delayUpdateMusicInfo({ ...state.musicInfo, name: 'old' })
  await vi.waitFor(() => { expect(finish).toBeTypeOf('function') })
  ++state.playbackGeneration
  finish(0)
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(native.updateNowPlayingMetadata).not.toHaveBeenCalled()
})
it('a stale duration lookup does not schedule old metadata refresh', async() => {
  let finish
  native.getDuration = vi.fn(async() => new Promise(resolve => { finish = resolve }))
  const refreshing = updateMetaData({ ...state.musicInfo, name: 'old' }, false, true)
  ++state.playbackGeneration
  finish(100)
  await refreshing
  for (const timer of timers.splice(0)) timer()
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(native.getState).not.toHaveBeenCalled()
})
