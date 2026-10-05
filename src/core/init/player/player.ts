import { addPlayedList, clearPlayedList } from '@/core/player/playedList'
import { pause, playNext } from '@/core/player/player'
import { setStatusText, setIsPlay } from '@/core/player/playStatus'
// import { resetPlayerMusicInfo } from '@/core/player/playInfo'
import { setStop } from '@/plugins/player'
import { delayUpdateMusicInfo } from '@/plugins/player/playList'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'


export default async(setting: LX.AppSetting) => {
  const setPlayStatus = (generation = playerState.playbackGeneration) => {
    if (generation !== playerState.playbackGeneration) return
    setIsPlay(true)
  }
  const setPauseStatus = (generation = playerState.playbackGeneration) => {
    if (generation !== playerState.playbackGeneration) return
    setIsPlay(false)
    if (global.lx.isPlayedStop) void pause()
  }

  const handleEnded = (generation = playerState.playbackGeneration) => {
    if (generation !== playerState.playbackGeneration) return
    // setTimeout(() => {
    if (global.lx.isPlayedStop) {
      setStatusText(global.i18n.t('player__end'))
      return
    }
    // resetPlayerMusicInfo()
    // global.app_event.stop()
    global.app_event.setProgress(0)
    setStatusText(global.i18n.t('player__end'))
    void playNext(true)
    // })
  }

  const setStopStatus = (generation = playerState.playbackGeneration, nativeStopped = false) => {
    if (generation !== playerState.playbackGeneration) return
    setIsPlay(false)
    setStatusText('')
    if (!nativeStopped) void setStop()
  }

  const updatePic = (generation = playerState.playbackGeneration) => {
    if (generation !== playerState.playbackGeneration) return
    if (!settingState.setting['player.isShowNotificationImage']) return
    if (playerState.playMusicInfo.musicInfo && playerState.musicInfo.pic) {
      delayUpdateMusicInfo(playerState.musicInfo)
    }
  }

  const handleConfigUpdated: typeof global.state_event.configUpdated = (keys, settings) => {
    if (keys.includes('player.togglePlayMethod')) {
      const newValue = settings['player.togglePlayMethod']
      if (playerState.playedList.length) clearPlayedList()
      const playMusicInfo = playerState.playMusicInfo
      if (newValue == 'random' && playMusicInfo.musicInfo && !playMusicInfo.isTempPlay) addPlayedList({ ...(playMusicInfo as LX.Player.PlayMusicInfo) })
    }
  }


  global.app_event.onSync('play', setPlayStatus)
  global.app_event.onSync('pause', setPauseStatus)
  global.app_event.onSync('error', setPauseStatus)
  global.app_event.onSync('stop', setStopStatus)
  global.app_event.on('playerEnded', handleEnded)
  global.app_event.on('picUpdated', updatePic)
  global.state_event.on('configUpdated', handleConfigUpdated)
}
