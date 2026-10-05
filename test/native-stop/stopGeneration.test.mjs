import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import native from './nativeMock.mjs'
import state from '@/store/player/state'
import { setStop } from '@/plugins/player/utils'
vi.mock('react-native-background-timer', () => ({ default: {} }))
vi.mock('@/plugins/player/playList', () => ({ playMusic: vi.fn(), invalidateResourceEnd: () => ++state.resourceOperationId, updateMetaData: vi.fn(), initTrackInfo: vi.fn() }))
vi.mock('@/plugins/player/hook', () => ({ useBufferProgress: vi.fn() }))
vi.mock('@/utils/fs', () => ({ existsFile: vi.fn(), moveFile: vi.fn(), privateStorageDirectoryPath: '', temporaryDirectoryPath: '' }))
vi.mock('@/utils/tools', () => ({ toast: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks()
  native.stop.mockResolvedValue()
  state.playbackGeneration = 1
  vi.stubGlobal('lx', { playerTrackId: 'old-native-track' })
})
afterEach(() => { vi.unstubAllGlobals() })
it.each(['new-native-track', 'old-native-track'])('late native stop must not skip a newer %s selection', async(trackId) => {
  let finish
  native.stop.mockImplementationOnce(async() => new Promise(resolve => { finish = resolve }))
  const stopping = setStop()
  ++state.playbackGeneration
  global.lx.playerTrackId = trackId
  finish()
  await stopping
  expect(native.skipToNext).not.toHaveBeenCalled()
})
it('same-owner stop retains the existing placeholder advance', async() => {
  await setStop()
  expect(native.stop).toHaveBeenCalledOnce()
  expect(native.skipToNext).toHaveBeenCalledOnce()
})
it('empty native queue has nothing to advance', async() => {
  global.lx.playerTrackId = 'queue//default'
  await setStop()
  expect(native.skipToNext).not.toHaveBeenCalled()
})
it('stop completion must not skip a resource installed within the same selection generation', async() => {
  let finish
  state.resourceTrackId = null
  native.stop.mockImplementationOnce(async() => new Promise(resolve => { finish = resolve }))
  const stopping = setStop()
  state.resourceTrackId = 'new-unique-audio'
  global.lx.playerTrackId = 'new-unique-audio'
  finish()
  await stopping
  expect(native.skipToNext).not.toHaveBeenCalled()
})
