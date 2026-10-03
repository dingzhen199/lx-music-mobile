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
  global.state_event.onSync('configUpdated', settings)
  global.state_event.onSync('playMusicInfoChanged', syncRecommendPlayer)
  global.state_event.onSync('playStateChanged', syncRecommendPlayer)
  global.state_event.onSync('playTempPlayListChanged', syncRecommendPlayer)
  global.state_event.onSync('playPlayedListChanged', syncRecommendPlayer)
  global.state_event.onSync('playProgressChanged', () => {
    const hadDuration = playProgress.maxPlayTime > 0
    Object.assign(playProgress, state.progress)
    if (!hadDuration && playProgress.maxPlayTime > 0) global.app_event.playerLoadeddata()
  })
  global.app_event.onSync('mylistUpdated', syncRecommendLists)
}
