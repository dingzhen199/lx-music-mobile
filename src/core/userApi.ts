import { action, state } from '@/store/userApi'
import { addUserApi, getUserApiScript, removeUserApi as removeUserApiFromStore, setUserApiAllowShowUpdateAlert as setUserApiAllowShowUpdateAlertFromStore } from '@/utils/data'
import { destroy, loadScript, setAllowShowUpdateAlert } from '@/utils/nativeModules/userApi'
import { log as writeLog } from '@/utils/log'
import { setUserApiBackups } from './apiSource'
import settingState from '@/store/setting/state'


const loading = new Map<string, symbol>()

export const setUserApi = async(apiId: string) => {
  const generation = Symbol(apiId)
  loading.set(apiId, generation)
  delete state.apis[apiId]
  delete state.qualityLists[apiId]
  action.setApiStatus(apiId, false, 'initing')
  const target = state.list.find(api => api.id === apiId)
  if (!target) throw new Error('api not found')
  let script: string
  try {
    script = await getUserApiScript(target.id)
  } catch (err) {
    if (loading.get(apiId) !== generation) return
    throw err
  }
  if (loading.get(apiId) !== generation) return
  if (!script.trim()) throw new Error('empty api script')
  const currentTarget = state.list.find(api => api.id === apiId)
  if (currentTarget) loadScript({ ...currentTarget, script })
}

export const destroyUserApi = (apiId?: string) => {
  if (apiId) loading.delete(apiId)
  else loading.clear()
  action.removeRuntime(apiId)
  destroy(apiId)
}


export const setUserApiStatus: typeof action['setStatus'] = (status, message) => {
  action.setStatus(status, message)
}

export const setUserApiList: typeof action['setUserApiList'] = (list) => {
  action.setUserApiList(list)
}

let mutationQueue: Promise<void> = Promise.resolve()
const mutateUserApi = async(task: () => Promise<void>) => {
  const result = mutationQueue.then(task)
  mutationQueue = result.catch(() => {})
  await result
}
export const importUserApi = async(script: string) => mutateUserApi(async() => {
  if (state.list.length >= 20) throw new Error(global.i18n.t('user_api_max_tip'))
  const info = await addUserApi(script.replace(/^\uFEFF/, '').trimStart())
  action.addUserApi(info)
})

export const removeUserApi = async(ids: string[]) => mutateUserApi(async() => {
  const list = await removeUserApiFromStore(ids)
  action.setUserApiList(list)
  for (const id of ids) destroyUserApi(id)
  setUserApiBackups(settingState.setting['common.apiSourceBackups'].filter(id => !ids.includes(id)))
})

export const setUserApiAllowShowUpdateAlert = async(id: string, enable: boolean) => mutateUserApi(async() => {
  await setUserApiAllowShowUpdateAlertFromStore(id, enable)
  action.setUserApiAllowShowUpdateAlert(id, enable)
  setAllowShowUpdateAlert(id, enable)
})

export const log = {
  r_info(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    writeLog.info(...params)
  },
  r_warn(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    writeLog.warn(...params)
  },
  r_error(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    writeLog.error(...params)
  },
  log(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    if (global.lx.isEnableUserApiLog) writeLog.info(...params)
  },
  info(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    if (global.lx.isEnableUserApiLog) writeLog.info(...params)
  },
  warn(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    if (global.lx.isEnableUserApiLog) writeLog.warn(...params)
  },
  error(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    if (global.lx.isEnableUserApiLog) writeLog.error(...params)
  },
}
