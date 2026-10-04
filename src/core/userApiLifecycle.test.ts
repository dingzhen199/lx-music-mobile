import { beforeEach, expect, it, vi } from 'vitest'
const env = vi.hoisted(() => ({
  state: { apis: {} as Record<string, any>, qualityLists: {} as Record<string, any>, statuses: {} as Record<string, any> },
  changed: vi.fn(), destroy: vi.fn(),
}))
vi.mock('@/store/userApi', async() => ({ state: env.state, action: await import('@/store/userApi/action') }))
vi.mock('@/store/userApi/state', () => ({ state: env.state }))
vi.mock('@/store/userApi/event', () => ({ event: { runtimes_changed: env.changed } }))
vi.mock('@/utils/data', () => ({}))
vi.mock('@/utils/nativeModules/userApi', () => ({ destroy: env.destroy }))
vi.mock('@/utils/log', () => ({ log: {} }))
vi.mock('./apiSource', () => ({}))
vi.mock('@/store/setting/state', () => ({ default: { setting: {} } }))
beforeEach(() => {
  vi.clearAllMocks()
  env.state.apis = { backup: { search: true } }
  env.state.qualityLists = { backup: {} }
  env.state.statuses = { backup: { status: true } }
})
it.each(['backup', undefined])('notifies capability subscribers after removing runtime %s', async(id) => {
  const { destroyUserApi } = await import('./userApi')
  env.changed.mockImplementationOnce(() => {
    expect(env.state.apis.backup).toBeUndefined()
    expect(env.state.qualityLists.backup).toBeUndefined()
    expect(env.state.statuses.backup).toBeUndefined()
  })
  destroyUserApi(id)
  expect(env.changed).toHaveBeenCalledTimes(1)
  expect(env.destroy).toHaveBeenCalledWith(id)
})
