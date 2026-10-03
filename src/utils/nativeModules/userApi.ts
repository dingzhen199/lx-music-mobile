import { NativeEventEmitter, NativeModules } from 'react-native'
import { createRuntimeRegistry } from '@/core/userApiRuntime'

const { UserApiModule } = NativeModules

const runtimes = createRuntimeRegistry<LX.UserApi.UserApiInfo>()
const destroyListeners = new Set<(apiId?: string) => void>()
export const onRuntimeDestroyed = (listener: (apiId?: string) => void) => {
  destroyListeners.add(listener)
  return () => { destroyListeners.delete(listener) }
}
export const loadScript = (info: LX.UserApi.UserApiInfo & { script: string }) => {
  for (const listener of destroyListeners) listener(info.id)
  const token = runtimes.load(info.id, info)
  UserApiModule.loadScript({
    id: info.id,
    token,
    name: info.name,
    description: info.description,
    version: info.version ?? '',
    author: info.author ?? '',
    homepage: info.homepage ?? '',
    script: info.script,
  })
}

export interface SendResponseParams {
  requestKey: string
  error: string | null
  response: {
    statusCode: number
    statusMessage: string
    headers: Record<string, string>
    body: any
  } | null
}
export interface SendActions {
  request: LX.UserApi.UserApiRequestParams
  response: SendResponseParams
}
export const sendAction = <T extends keyof SendActions>(action: T, data: SendActions[T], apiId: string, token?: string) => {
  const currentToken = runtimes.token(apiId)
  if (!currentToken || (token != null && token !== currentToken)) return
  UserApiModule.sendAction(apiId, currentToken, action, JSON.stringify(data))
}

// export const clearAppCache = CacheModule.clearAppCache as () => Promise<void>

export interface InitParams {
  status: boolean
  errorMessage: string
  info: LX.UserApi.UserApiInfo
}

export interface ResponseParams {
  status: boolean
  errorMessage?: string
  requestKey: string
  result: any
}
export interface UpdateInfoParams {
  name: string
  log: string
  updateUrl: string
}
export interface RequestParams {
  requestKey: string
  url: string
  options: {
    method: string
    data: any
    timeout: number
    headers: any
    binary: boolean
  }
}
export type CancelRequestParams = string

export interface Actions {
  init: InitParams
  request: RequestParams
  cancelRequest: CancelRequestParams
  response: ResponseParams
  showUpdateAlert: UpdateInfoParams
  log: string
}
export type ActionsEvent = { [K in keyof Actions]: { action: K, data: Actions[K], apiId: string, token: string } }[keyof Actions]

export const onScriptAction = (handler: (event: ActionsEvent) => void): () => void => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(UserApiModule)
  const eventListener = eventEmitter.addListener('api-action', event => {
    const { apiId, token } = (event ?? {}) as { apiId?: unknown, token?: unknown }
    if (typeof apiId !== 'string' || typeof token !== 'string') return
    const loadScriptInfo = runtimes.get(apiId, token)
    if (!loadScriptInfo) return
    if (event.data) {
      try { event.data = JSON.parse(event.data as string) } catch { return }
    }
    if (event.action === 'init' && (!event.data || typeof event.data !== 'object')) return
    if (event.action == 'init') {
      if (event.data.info) event.data.info = { ...loadScriptInfo, ...event.data.info }
      else event.data.info = { ...loadScriptInfo }
    } else if (event.action == 'showUpdateAlert') {
      if (!loadScriptInfo?.allowShowUpdateAlert) return
    }
    handler(event as ActionsEvent)
  })

  return () => {
    eventListener.remove()
  }
}

export const destroy = (apiId?: string) => {
  for (const listener of destroyListeners) listener(apiId)
  if (apiId) runtimes.remove(apiId)
  else runtimes.clear()
  UserApiModule.destroy(apiId ?? '')
}


export const setAllowShowUpdateAlert = (id: string, enable: boolean) => {
  const token = runtimes.token(id)
  const info = token ? runtimes.get(id, token) : undefined
  if (info) info.allowShowUpdateAlert = enable
}
