import { playNext, setMusicUrl } from '@/core/player/player'
import { setStatusText } from '@/core/player/playStatus'
import { getPosition, isEmpty, setStop } from '@/plugins/player'
import { isActive } from '@/utils/tools'
import BackgroundTimer from 'react-native-background-timer'
import playerState from '@/store/player/state'
import { setNowPlayTime } from '@/core/player/progress'


export default () => {
  let retryNum = 0
  let prevTimeoutId: string | null = null

  let loadingTimeout: number | null = null
  let delayNextTimeout: number | null = null
  let delayNextSchedule: ReturnType<typeof setTimeout> | null = null
  const captureOwner = (generation = playerState.playbackGeneration) => {
    const musicInfo = playerState.playMusicInfo.musicInfo
    const operationId = playerState.resourceOperationId
    return () => operationId === playerState.resourceOperationId && musicInfo != null && generation === playerState.playbackGeneration && musicInfo === playerState.playMusicInfo.musicInfo
  }
  const startLoadingTimeout = (isCurrent: () => boolean) => {
    // console.log('start load timeout')
    clearLoadingTimeout()
    const timeout = BackgroundTimer.setTimeout(() => {
      if (loadingTimeout !== timeout || !isCurrent() || global.lx.isPlayedStop) return
      loadingTimeout = null
      // if (global.lx.isPlayedStop) {
      //   prevTimeoutId = null
      //   setStatusText('')
      //   return
      // }

      // 如果加载超时，则尝试刷新URL
      if (prevTimeoutId == playerState.musicInfo.id) {
        prevTimeoutId = null
        void playNext(true, 'error')
      } else {
        prevTimeoutId = playerState.musicInfo.id
        if (playerState.playMusicInfo.musicInfo) setMusicUrl(playerState.playMusicInfo.musicInfo, true)
      }
    }, 25000)
    loadingTimeout = timeout
  }
  const clearLoadingTimeout = () => {
    if (loadingTimeout == null) return
    // console.log('clear load timeout')
    BackgroundTimer.clearTimeout(loadingTimeout)
    loadingTimeout = null
  }

  const clearDelayNextTimeout = () => {
    // console.log(this.delayNextTimeout)
    if (delayNextSchedule != null) {
      clearTimeout(delayNextSchedule)
      delayNextSchedule = null
    }
    if (delayNextTimeout == null) return
    BackgroundTimer.clearTimeout(delayNextTimeout)
    delayNextTimeout = null
  }
  const addDelayNextTimeout = (isCurrent: () => boolean) => {
    if (!isCurrent()) return
    clearDelayNextTimeout()
    const timeout = BackgroundTimer.setTimeout(() => {
      if (delayNextTimeout !== timeout || !isCurrent()) return
      delayNextTimeout = null
      if (global.lx.isPlayedStop) {
        setStatusText('')
        return
      }
      void playNext(true, 'error')
    }, 5000)
    delayNextTimeout = timeout
  }

  const handleLoadstart = (generation = playerState.playbackGeneration) => {
    const isCurrent = captureOwner(generation)
    if (!isCurrent()) return
    console.log('handleLoadstart', playerState.isPlay)
    if (global.lx.isPlayedStop || !playerState.isPlay) return
    startLoadingTimeout(isCurrent)
    setStatusText(global.i18n.t('player__loading'))
  }

  // const handleLoadeddata = () => {
  //   setStatusText(global.i18n.t('player__loading'))
  // }

  // const handleCanplay = () => {
  //   setStatusText('')
  // }

  const handlePlaying = (generation = playerState.playbackGeneration) => {
    if (generation !== playerState.playbackGeneration) return
    setStatusText('')
    clearLoadingTimeout()
    clearDelayNextTimeout()
  }

  const handleEmpied = (generation = playerState.playbackGeneration) => {
    if (generation !== playerState.playbackGeneration) return
    clearDelayNextTimeout()
    clearLoadingTimeout()
  }

  const handleWating = (generation = playerState.playbackGeneration) => {
    if (generation !== playerState.playbackGeneration) return
    setStatusText(global.i18n.t('player__buffering'))
  }

  const handleError = (generation = playerState.playbackGeneration) => {
    const isCurrent = captureOwner(generation)
    if (!playerState.musicInfo.id || !isCurrent()) return
    clearLoadingTimeout()
    if (global.lx.isPlayedStop) return
    if (playerState.playMusicInfo.musicInfo && retryNum < 2) { // 若音频URL无效则尝试刷新2次URL
      let musicInfo = playerState.playMusicInfo.musicInfo
      void getPosition().then((position) => {
        if (position && isCurrent() && !global.lx.isPlayedStop) setNowPlayTime(position)
      }).catch(() => { /* Missing native position must not prevent a current-owner URL retry. */ }).finally(() => {
        // console.log(this.retryNum)
        if (!isCurrent() || global.lx.isPlayedStop) return
        retryNum++
        setMusicUrl(musicInfo, true)
        setStatusText(global.i18n.t('player__refresh_url'))
      })
      return
    }
    if (!isEmpty()) void setStop().catch(() => {})
    const isRecoveryCurrent = captureOwner(generation)

    if (isActive()) {
      setStatusText(global.i18n.t('player__error'))
      clearDelayNextTimeout()
      const schedule = setTimeout(() => {
        if (delayNextSchedule !== schedule || !isRecoveryCurrent()) return
        delayNextSchedule = null
        addDelayNextTimeout(isRecoveryCurrent)
      })
      delayNextSchedule = schedule
    } else {
      console.warn('error skip to next')
      void playNext(true, 'error')
    }
  }

  const handleSetPlayInfo = (_reason?: unknown, generation = playerState.playbackGeneration) => {
    if (generation !== playerState.playbackGeneration) return
    retryNum = 0
    prevTimeoutId = null
    clearDelayNextTimeout()
    clearLoadingTimeout()
  }

  // const handlePlayedStop = () => {
  //   clearDelayNextTimeout()
  //   clearLoadingTimeout()
  // }


  global.app_event.on('playerLoadstart', handleLoadstart)
  // global.app_event.on('playerLoadeddata', handleLoadeddata)
  // global.app_event.on('playerCanplay', handleCanplay)
  global.app_event.on('playerPlaying', handlePlaying)
  global.app_event.on('playerWaiting', handleWating)
  global.app_event.on('playerEmptied', handleEmpied)
  global.app_event.on('playerError', handleError)
  global.app_event.onSync('musicToggled', handleSetPlayInfo)
}
