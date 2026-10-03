import state from '@/store/player/state'
import settingState from '@/store/setting/state'
import { syncRecommendSettings } from './setting'
import { syncRecommendPlayer } from './playerState'
import { syncRecommendLists } from './listState'
import { playProgress } from './playProgress'
import { playbackRate } from './playbackRate'
let initialized = false
export const initRecommendAdapters = () => {
  if (initialized) return
  initialized = true
  const settings = () => {
    syncRecommendSettings()
    playbackRate.value = settingState.setting['player.playbackRate']
  }
  settings()
  syncRecommendPlayer()
  syncRecommendLists()
  global.state_event.on('configUpdated', settings)
  global.state_event.on('playMusicInfoChanged', syncRecommendPlayer)
  global.state_event.on('playStateChanged', syncRecommendPlayer)
  global.state_event.on('playTempPlayListChanged', syncRecommendPlayer)
  global.state_event.on('playPlayedListChanged', syncRecommendPlayer)
  global.state_event.on('playProgressChanged', () => {
    const hadDuration = playProgress.maxPlayTime > 0
    Object.assign(playProgress, state.progress)
    if (!hadDuration && playProgress.maxPlayTime > 0) global.app_event.playerLoadeddata()
  })
  global.app_event.on('mylistUpdated', syncRecommendLists)
}
