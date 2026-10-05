import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import native from './nativeMock.mjs'
import { initial } from '@/plugins/player'
const setup = vi.hoisted(() => ({ migrate: vi.fn(async() => {}), options: vi.fn(async() => {}), volume: vi.fn(async() => {}), rate: vi.fn(async() => {}) }))
vi.mock('@/plugins/player/utils', () => ({ migratePlayerCache: setup.migrate, updateOptions: setup.options, setVolume: setup.volume, setPlaybackRate: setup.rate }))
const options = { volume: 1, playRate: 1, cacheSize: 0, isHandleAudioFocus: true, isEnableAudioOffload: false }
beforeEach(() => {
  vi.clearAllMocks()
  native.setupPlayer = vi.fn(async() => {})
  setup.options.mockResolvedValue()
  vi.stubGlobal('lx', { playerStatus: { isInitialized: false, isIniting: false } })
})
afterEach(() => { vi.unstubAllGlobals() })
it.each(['native setup', 'options'])('concurrent selections wait for the same %s initialization', async(stage) => {
  let finish
  const deferred = stage === 'native setup' ? native.setupPlayer : setup.options
  deferred.mockImplementationOnce(async() => new Promise(resolve => { finish = resolve }))
  const first = initial(options)
  await vi.waitFor(() => { expect(finish).toBeTypeOf('function') })
  let secondCompleted = false
  const second = initial(options).then(() => { secondCompleted = true })
  await Promise.resolve()
  try { expect(secondCompleted).toBe(false) } finally { finish(); await Promise.all([first, second]) }
  expect(native.setupPlayer).toHaveBeenCalledOnce()
  expect(global.lx.playerStatus.isInitialized).toBe(true)
  expect(global.lx.playerStatus.isIniting).toBe(false)
})
it('a failed initialization releases its in-progress state for a retry', async() => {
  native.setupPlayer.mockRejectedValueOnce(new Error('setup failed'))
  await expect(initial(options)).rejects.toThrow('setup failed')
  expect(global.lx.playerStatus.isIniting).toBe(false)
  expect(global.lx.playerStatus.isInitialized).toBe(false)
  await initial(options)
  expect(native.setupPlayer).toHaveBeenCalledTimes(2)
})
