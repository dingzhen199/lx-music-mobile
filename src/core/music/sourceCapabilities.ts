import { state as userApi } from '@/store/userApi'
import settingState from '@/store/setting/state'
import { normalizeApiSourceBackups } from '../userApiConfig'
import { isProviderServable, type SourceRotationEnv } from './sourceRotation'

/** UI 与取流链使用同一份启用、就绪及取流能力快照。 */
export const sourceRotationEnv = (): SourceRotationEnv => {
  const primaryApiId = settingState.setting['common.apiSource']
  const readyApiIds = Object.keys(userApi.apis)
  const servedProviders: Record<string, string[]> = {}
  for (const apiId of readyApiIds) {
    servedProviders[apiId] = Object.keys(userApi.qualityLists[apiId] ?? {})
      .filter(provider => typeof userApi.apis[apiId]?.[provider as LX.Source]?.getMusicUrl === 'function')
  }
  return {
    primaryApiId,
    primaryServedProviders: Object.keys(global.lx.qualityList),
    backupApiIds: normalizeApiSourceBackups(primaryApiId, settingState.setting['common.apiSourceBackups']),
    readyApiIds,
    servedProviders,
  }
}

/** 仅供播放入口使用；下载等其他能力仍按其自身规则判断。 */
export const assertPlaybackSupport = (source: LX.Source): boolean => {
  return source === 'local' || isProviderServable(sourceRotationEnv(), source)
}
