import { reactive } from './reactive'
import state from '@/store/setting/state'
export const appSetting = reactive({ ...state.setting })
export const syncRecommendSettings = () => { Object.assign(appSetting, state.setting) }
