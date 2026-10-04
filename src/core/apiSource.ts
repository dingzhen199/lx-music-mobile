import musicSdk from '@/utils/musicSdk'
import { updateSetting } from './common'
import settingState from '@/store/setting/state'
import { state, action } from '@/store/userApi'
import { destroyUserApi, setUserApi, setUserApiStatus } from './userApi'
import { normalizeApiSourceBackups, USER_API_INIT_TIMEOUT_MS } from './userApiConfig'

let primaryId: string | undefined
let generation = 0
const loadedIds = new Set<string>()

const syncRuntimes = () => {
  const desired = new Set([settingState.setting['common.apiSource'], ...normalizeApiSourceBackups(settingState.setting['common.apiSource'], settingState.setting['common.apiSourceBackups'])]
    .filter(id => id.startsWith('user_api') && state.list.some(api => api.id === id)))
  for (const id of loadedIds) {
    if (desired.has(id)) continue
    loadedIds.delete(id)
    destroyUserApi(id)
  }
  for (const id of desired) {
    if (loadedIds.has(id)) continue
    loadedIds.add(id)
    void setUserApi(id).catch((err: Error) => {
      if (!loadedIds.has(id)) return
      action.setApiStatus(id, false, err.message)
      if (id !== primaryId) return
      setUserApiStatus(false, err.message)
      global.lx.apiInitPromise[2](false)
    })
  }
}

export const setUserApiBackups = (ids: string[]) => {
  const backups = normalizeApiSourceBackups(settingState.setting['common.apiSource'], ids)
    .filter(id => state.list.some(api => api.id === id))
  updateSetting({ 'common.apiSourceBackups': backups })
  syncRuntimes()
}

export const setApiSource = (apiId: string) => {
  if (primaryId === apiId) return
  if (!global.lx.apiInitPromise[1]) global.lx.apiInitPromise[2](false)
  primaryId = apiId
  const currentGeneration = ++generation
  updateSetting({
    'common.apiSource': apiId,
    'common.apiSourceBackups': normalizeApiSourceBackups(apiId, settingState.setting['common.apiSourceBackups']),
  })
  global.lx.qualityList = {}
  global.lx.apis = {}
  global.lx.apiInitPromise[1] = false
  global.lx.apiInitPromise[0] = new Promise<boolean>(resolve => {
    const timer = setTimeout(() => {
      if (currentGeneration !== generation) return
      if (apiId.startsWith('user_api')) action.setApiStatus(apiId, false, 'init timeout')
      setUserApiStatus(false, 'init timeout')
      global.lx.apiInitPromise[2](false)
    }, USER_API_INIT_TIMEOUT_MS)
    global.lx.apiInitPromise[2] = (result: boolean) => {
      clearTimeout(timer)
      resolve(result)
      if (currentGeneration !== generation) return
      global.lx.apiInitPromise[1] = true
      // Late success may recover subsequent requests without extending old waiters.
      global.lx.apiInitPromise[0] = Promise.resolve(result)
    }
  })
  global.state_event.apiSourceUpdated(apiId)
  syncRuntimes()
  if (apiId.startsWith('user_api')) {
    const status = state.statuses[apiId]
    setUserApiStatus(status?.status ?? false, status?.message ?? 'initing')
    if (state.apis[apiId]) {
      global.lx.apis = state.apis[apiId]
      global.lx.qualityList = state.qualityLists[apiId] ?? {}
      global.lx.apiInitPromise[2](true)
    } else if (!loadedIds.has(apiId) || (status && status.message !== 'initing')) global.lx.apiInitPromise[2](false)
  } else {
    // @ts-expect-error built-in source keys are defined by the music SDK
    global.lx.qualityList = musicSdk.supportQuality[apiId] ?? {}
    global.lx.apiInitPromise[2](true)
  }
}
