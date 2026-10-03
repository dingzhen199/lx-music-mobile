import { reactive } from './reactive'
import state from '@/store/list/state'
export const loveList = state.loveList
export const userLists = reactive<LX.List.UserListInfo[]>([])
export const syncRecommendLists = () => { userLists.splice(0, userLists.length, ...state.userList) }
