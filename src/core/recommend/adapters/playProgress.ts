import { reactive } from './reactive'
import state from '@/store/player/state'
export const playProgress = reactive({ ...state.progress })
