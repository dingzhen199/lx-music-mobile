import { beforeEach, describe, expect, it, vi } from 'vitest'
const native = vi.hoisted(() => ({
  loadScript: vi.fn(), sendAction: vi.fn(), destroy: vi.fn(), listener: (_event: any) => {},
}))
vi.mock('react-native', () => ({
  NativeModules: { UserApiModule: native },
  NativeEventEmitter: class {
    addListener(_name: string, listener: (event: any) => void) {
      native.listener = listener
      return { remove: vi.fn() }
    }
  },
}))
import { destroy, loadScript, onScriptAction, sendAction } from './userApi'
const info = (id: string) => ({ id, name: id, script: '', version: '', description: '', author: '', homepage: '', allowShowUpdateAlert: true })
beforeEach(() => { destroy(); vi.clearAllMocks() })
describe('native script event identity', () => {
  it('discards old same-ID init rather than relabeling it as the current script', () => {
    const listener = vi.fn()
    onScriptAction(listener)
    loadScript(info('a'))
    const old = native.loadScript.mock.calls[0][0]
    loadScript(info('a'))
    const current = native.loadScript.mock.calls[1][0]
    native.listener({ action: 'init', apiId: 'a', token: old.token, data: JSON.stringify({ status: true }) })
    expect(listener).not.toHaveBeenCalled()
    native.listener({ action: 'init', apiId: 'a', token: current.token, data: JSON.stringify({ status: true }) })
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ apiId: 'a', data: expect.objectContaining({ info: expect.objectContaining({ id: 'a' }) }) }))
  })
  it('isolates backup events and rejects network responses for a replaced runtime', () => {
    const listener = vi.fn()
    onScriptAction(listener)
    loadScript(info('a'))
    loadScript(info('b'))
    const backup = native.loadScript.mock.calls[1][0]
    destroy('a')
    native.listener({ action: 'init', apiId: 'b', token: backup.token, data: JSON.stringify({ status: true }) })
    expect(listener).toHaveBeenCalledOnce()
    loadScript(info('b'))
    sendAction('response', { requestKey: 'network', error: null, response: null }, 'b', backup.token)
    expect(native.sendAction).not.toHaveBeenCalled()
  })
})
