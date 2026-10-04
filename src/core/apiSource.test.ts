import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const env = vi.hoisted(() => ({
  setting: { 'common.apiSource': '', 'common.apiSourceBackups': [] as string[] },
  state: { list: [{ id: 'user_api_a' }, { id: 'user_api_b' }], apis: {} as Record<string, any>, qualityLists: {}, statuses: {} as Record<string, any> },
  apiStatus: vi.fn(), load: vi.fn(), destroy: vi.fn(), status: vi.fn(),
}))
vi.mock('@/utils/musicSdk', () => ({ default: { supportQuality: { built_in: { wy: ['128k'] } } } }))
vi.mock('@/store/setting/state', () => ({ default: { setting: env.setting } }))
vi.mock('@/store/userApi', () => ({ state: env.state, action: { setApiStatus: env.apiStatus } }))
vi.mock('./common', () => ({ updateSetting: (value: any) => Object.assign(env.setting, value) }))
vi.mock('./userApi', () => ({ setUserApi: env.load, destroyUserApi: env.destroy, setUserApiStatus: env.status }))
beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.clearAllMocks()
  env.setting['common.apiSource'] = ''
  env.setting['common.apiSourceBackups'] = []
  env.state.apis = {}
  env.state.statuses = {}
  env.load.mockResolvedValue(undefined)
  vi.stubGlobal('lx', { apis: {}, qualityList: {}, apiInitPromise: [Promise.resolve(true), true, vi.fn()] })
  vi.stubGlobal('state_event', { apiSourceUpdated: vi.fn() })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
it('switching releases old waiters and gives the new generation its own deadline', async() => {
  const { setApiSource } = await import('./apiSource')
  setApiSource('user_api_a')
  const old = global.lx.apiInitPromise[0]
  await vi.advanceTimersByTimeAsync(9000)
  setApiSource('user_api_b')
  await expect(old).resolves.toBe(false)
  const current = global.lx.apiInitPromise[0]
  await vi.advanceTimersByTimeAsync(1000)
  expect(global.lx.apiInitPromise[1]).toBe(false)
  await vi.advanceTimersByTimeAsync(9000)
  await expect(current).resolves.toBe(false)
  global.lx.apiInitPromise[2](true)
  await expect(global.lx.apiInitPromise[0]).resolves.toBe(true)
})
it('loads backups without changing primary readiness or unloading the primary', async() => {
  const { setApiSource, setUserApiBackups } = await import('./apiSource')
  setApiSource('user_api_a')
  const readiness = global.lx.apiInitPromise[0]
  setUserApiBackups(['user_api_b', 'user_api_a', 'user_api_b'])
  expect(env.setting['common.apiSourceBackups']).toEqual(['user_api_b'])
  expect(env.load.mock.calls.map(call => call[0])).toEqual(['user_api_a', 'user_api_b'])
  expect(global.lx.apiInitPromise[0]).toBe(readiness)
  expect(env.destroy).not.toHaveBeenCalled()
  setUserApiBackups([])
  expect(env.destroy).toHaveBeenCalledWith('user_api_b')
})

it('publishes a primary readiness timeout to per-API capability subscribers', async() => {
  const { setApiSource } = await import('./apiSource')
  setApiSource('user_api_a')
  await vi.advanceTimersByTimeAsync(10000)
  expect(env.apiStatus).toHaveBeenCalledWith('user_api_a', false, 'init timeout')
})
