import { reactive, ref } from './reactive'
import state from '@/store/player/state'
export const playMusicInfo = reactive({ ...state.playMusicInfo })
export const isPlay = ref(state.isPlay)
export const tempPlayList = reactive<LX.Player.PlayMusicInfo[]>([])
export const playedList = reactive<LX.Player.PlayMusicInfo[]>([])
export const syncRecommendPlayer = () => {
  Object.assign(playMusicInfo, state.playMusicInfo, { alternativeMusicInfos: state.playMusicInfo.alternativeMusicInfos, recommendationSessionId: state.playMusicInfo.recommendationSessionId })
  isPlay.value = state.isPlay
  tempPlayList.splice(0, tempPlayList.length, ...state.tempPlayList)
  playedList.splice(0, playedList.length, ...state.playedList)
}
