import playerActions from '@/store/player/action'
import { getPreferredVersion } from '@/core/music/versionPreference'
import { isInitialized, initial as playerInitial, isEmpty, setPause, setPlay, setResource, setStop, initTrackInfo } from '@/plugins/player'
import {
  setStatusText,
} from '@/core/player/playStatus'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'
import {
  getList,
  setPlayMusicInfo,
  setMusicInfo,
  setPlayListId,
} from '@/core/player/playInfo'
import {
  clearPlayedList,
  addPlayedList,
  removePlayedList,
} from '@/core/player/playedList'
import {
  clearTempPlayeList,
  removeTempPlayList,
} from '@/core/player/tempPlayList'
import { getMusicUrl, getPicPath, getLyricInfo } from '@/core/music'
import { requestMsg } from '@/utils/message'
import { getRandom } from '@/utils/common'
import { filterList } from './utils'
import BackgroundTimer from 'react-native-background-timer'
import { checkIgnoringBatteryOptimization, checkNotificationPermission, debounceBackgroundTimer, toast } from '@/utils/tools'
import { LIST_IDS } from '@/config/constant'
import { addListMusics, removeListMusics } from '@/core/list'
import { addDislikeInfo } from '@/core/dislikeList'

// import { checkMusicFileAvailable } from '@renderer/utils/music'

const createDelayNextTimeout = (delay: number) => {
  let timeout: number | null
  const clearDelayNextTimeout = () => {
    // console.log(this.timeout)
    if (timeout) {
      BackgroundTimer.clearTimeout(timeout)
      timeout = null
    }
  }

  const addDelayNextTimeout = () => {
    const generation = playerState.playbackGeneration
    const operationId = playerState.resourceOperationId
    clearDelayNextTimeout()
    timeout = BackgroundTimer.setTimeout(() => {
      timeout = null
      if (global.lx.isPlayedStop || operationId !== playerState.resourceOperationId || generation !== playerState.playbackGeneration) return
      console.log('delay next timeout timeout', delay)
      void playNext(true, 'error')
    }, delay)
  }

  return {
    clearDelayNextTimeout,
    addDelayNextTimeout,
  }
}
const { addDelayNextTimeout, clearDelayNextTimeout } = createDelayNextTimeout(5000)
const { addDelayNextTimeout: addLoadTimeout, clearDelayNextTimeout: clearLoadTimeout } = createDelayNextTimeout(100000)

const createGettingUrlId = (musicInfo: LX.Music.MusicInfo | LX.Download.ListItem) => {
  const tInfo = 'progress' in musicInfo ? musicInfo.metadata.musicInfo.meta.toggleMusicInfo : musicInfo.meta.toggleMusicInfo
  return `${musicInfo.id}_${tInfo?.id ?? ''}`
}
/**
 * 检查音乐信息是否已更改
 */
const diffCurrentMusicInfo = (curMusicInfo: LX.Music.MusicInfo | LX.Download.ListItem): boolean => {
  // return curMusicInfo !== playerState.playMusicInfo.musicInfo || playerState.isPlay
  return createGettingUrlId(curMusicInfo) != global.lx.gettingUrlId || curMusicInfo.id != playerState.playMusicInfo.musicInfo?.id || playerState.isPlay
}

let musicUrlRequestId = 0
let musicUrlGeneration = 0
let musicUrlOperationId = 0
const isStaleMusicUrlRequest = (musicInfo: LX.Music.MusicInfo | LX.Download.ListItem, requestId: number): boolean => {
  return musicUrlOperationId !== playerState.resourceOperationId || requestId !== musicUrlRequestId || musicUrlGeneration !== playerState.playbackGeneration || global.lx.isPlayedStop || diffCurrentMusicInfo(musicInfo)
}

const getMusicPlayUrl = async(musicInfo: LX.Music.MusicInfo | LX.Download.ListItem, requestId: number, isRefresh = false, isRetryed = false, onResolvedMusicInfo?: (info: LX.Music.MusicInfoOnline) => void, onFallback?: () => void): Promise<string | null> => {
  // this.musicInfo.url = await getMusicPlayUrl(targetSong, type)
  setStatusText(global.i18n.t('player__getting_url'))
  addLoadTimeout()

  return getMusicUrl({
    musicInfo,
    isRefresh,
    alternativeMusicInfos: musicInfo === playerState.playMusicInfo.musicInfo ? playerState.playMusicInfo.alternativeMusicInfos : undefined,
    onResolvedMusicInfo,
    onToggleSource(mInfo) {
      if (isStaleMusicUrlRequest(musicInfo, requestId)) return
      onFallback?.()
      setStatusText(global.i18n.t('toggle_source_try'))
    },
    onToggleApiSource() {
      if (isStaleMusicUrlRequest(musicInfo, requestId)) return
      setStatusText(global.i18n.t('setting_basic_source_backup'))
    },
  }).then(url => {
    if (isStaleMusicUrlRequest(musicInfo, requestId)) return null

    return url
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  }).catch(err => {
    // console.log('err', err.message)
    if (isStaleMusicUrlRequest(musicInfo, requestId) ||
      err.message == requestMsg.cancelRequest) return null

    // 429 不再等待重试同源：音源轮换已在取流链内完成（ADR-0003）
    if (!isRetryed) return getMusicPlayUrl(musicInfo, requestId, isRefresh, true, onResolvedMusicInfo, onFallback)

    throw err
  })
}

export const setMusicUrl = (musicInfo: LX.Music.MusicInfo | LX.Download.ListItem, isRefresh?: boolean) => {
  // addLoadTimeout()
  if (!diffCurrentMusicInfo(musicInfo)) return
  global.lx.gettingUrlId = createGettingUrlId(musicInfo)
  const requestId = ++musicUrlRequestId
  musicUrlGeneration = playerState.playbackGeneration
  musicUrlOperationId = playerState.resourceOperationId
  let resolvedMusicInfo: LX.Music.MusicInfoOnline | undefined
  let fallbackAttempted = false
  void getMusicPlayUrl(musicInfo, requestId, isRefresh, false, info => { resolvedMusicInfo = info }, () => { fallbackAttempted = true }).then((url) => {
    if (!url || isStaleMusicUrlRequest(musicInfo, requestId)) return
    setResource(musicInfo, url, playerState.progress.nowPlayTime)
    if (resolvedMusicInfo) {
      playerActions.setResolvedMusicInfo(resolvedMusicInfo)
      const original = 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
      if (getPreferredVersion(original).id !== resolvedMusicInfo.id) toast(global.i18n.t('playback_rescue_notice'), 'long')
    } else if (fallbackAttempted) {
      playerActions.setTemporarySourceUnknown()
      toast(global.i18n.t('playback_rescue_notice'), 'long')
    }
  }).catch((err: any) => {
    if (isStaleMusicUrlRequest(musicInfo, requestId)) return
    console.log(err)
    setStatusText(String(err.message))
    global.app_event.error()
    addDelayNextTimeout()
  }).finally(() => {
    // 同曲换源会改变歌曲身份；清理权只属于发起本次取流的请求。
    if (requestId === musicUrlRequestId && musicUrlGeneration === playerState.playbackGeneration) {
      global.lx.gettingUrlId = ''
      clearLoadTimeout()
    }
  })
}

const isCurrentMusic = (info: LX.Music.MusicInfo | LX.Download.ListItem): boolean => playerState.playMusicInfo.musicInfo === info

// 恢复上次播放的状态
const handleRestorePlay = async(restorePlayInfo: LX.Player.SavedPlayInfo) => {
  const generation = playerState.playbackGeneration
  const operationId = playerState.resourceOperationId
  const musicInfo = playerState.playMusicInfo.musicInfo
  if (!musicInfo) return

  setTimeout(() => {
    if (operationId !== playerState.resourceOperationId || generation !== playerState.playbackGeneration) return
    global.app_event.setProgress(settingState.setting['player.isSavePlayTime'] ? restorePlayInfo.time : 0, restorePlayInfo.maxTime)
  })

  const playMusicInfo = playerState.playMusicInfo

  void initTrackInfo(musicInfo, playerState.musicInfo)

  void getPicPath({ musicInfo, listId: playMusicInfo.listId }).then((url: string) => {
    if (
      (!isCurrentMusic(musicInfo) || generation !== playerState.playbackGeneration) ||
      playerState.musicInfo.pic == url ||
      playerState.loadErrorPicUrl == url
    ) return
    setMusicInfo({ pic: url })
    global.app_event.picUpdated()
  }).catch(() => {})

  void getLyricInfo({ musicInfo }).then((lyricInfo) => {
    if ((!isCurrentMusic(musicInfo) || generation !== playerState.playbackGeneration)) return
    setMusicInfo({
      lrc: lyricInfo.lyric,
      tlrc: lyricInfo.tlyric,
      lxlrc: lyricInfo.lxlyric,
      rlrc: lyricInfo.rlyric,
      rawlrc: lyricInfo.rawlrcInfo.lyric,
    })
    global.app_event.lyricUpdated()
  }).catch((err) => {
    console.log(err)
    if ((!isCurrentMusic(musicInfo) || generation !== playerState.playbackGeneration)) return
    setStatusText(global.i18n.t('lyric__load_error'))
  })

  if (settingState.setting['player.togglePlayMethod'] == 'random' && !playMusicInfo.isTempPlay) addPlayedList(playMusicInfo as LX.Player.PlayMusicInfo)
}


const debouncePlay = debounceBackgroundTimer(({ musicInfo, generation, operationId }: { musicInfo: LX.Player.PlayMusic, generation: number, operationId: number }) => {
  if (operationId !== playerState.resourceOperationId || !isCurrentMusic(musicInfo) || generation !== playerState.playbackGeneration) return
  setMusicUrl(musicInfo)

  void getPicPath({ musicInfo, listId: playerState.playMusicInfo.listId }).then((url: string) => {
    if (
      (!isCurrentMusic(musicInfo) || generation !== playerState.playbackGeneration) ||
      playerState.musicInfo.pic == url ||
      playerState.loadErrorPicUrl == url) return
    setMusicInfo({ pic: url })
    global.app_event.picUpdated()
  }).catch(() => {})

  void getLyricInfo({ musicInfo }).then((lyricInfo) => {
    if ((!isCurrentMusic(musicInfo) || generation !== playerState.playbackGeneration)) return
    setMusicInfo({
      lrc: lyricInfo.lyric,
      tlrc: lyricInfo.tlyric,
      lxlrc: lyricInfo.lxlyric,
      rlrc: lyricInfo.rlyric,
      rawlrc: lyricInfo.rawlrcInfo.lyric,
    })
    global.app_event.lyricUpdated()
  }).catch((err) => {
    console.log(err)
    if ((!isCurrentMusic(musicInfo) || generation !== playerState.playbackGeneration)) return
    setStatusText(global.i18n.t('lyric__load_error'))
  })
}, 200)

// 处理音乐播放
const handlePlay = async() => {
  const generation = playerState.playbackGeneration
  let operationId = playerState.resourceOperationId
  const current = () => operationId === playerState.resourceOperationId && generation === playerState.playbackGeneration
  global.lx.gettingUrlId = ''
  // Claim restore intent before awaiting setup so another selection cannot inherit it.
  const restorePlayInfo = global.lx.restorePlayInfo
  global.lx.restorePlayInfo = null
  if (!isInitialized()) {
    await checkNotificationPermission()
    if (!current()) return
    void checkIgnoringBatteryOptimization()
    await playerInitial({
      volume: settingState.setting['player.volume'],
      playRate: settingState.setting['player.playbackRate'],
      cacheSize: settingState.setting['player.cacheSize'] ? parseInt(settingState.setting['player.cacheSize']) : 0,
      isHandleAudioFocus: settingState.setting['player.isHandleAudioFocus'],
      isEnableAudioOffload: settingState.setting['player.isEnableAudioOffload'],
    })
    if (!current()) return
  }

  global.lx.isPlayedStop &&= false
  resetRandomNextMusicInfo()

  if (restorePlayInfo) {
    void handleRestorePlay(restorePlayInfo)
    return
  }

  const playMusicInfo = playerState.playMusicInfo
  const musicInfo = playMusicInfo.musicInfo

  if (!musicInfo) return

  const stopping = setStop()
  operationId = playerState.resourceOperationId
  await stopping
  if (!current()) return
  global.app_event.pause()

  clearDelayNextTimeout()
  clearLoadTimeout()


  if (settingState.setting['player.togglePlayMethod'] == 'random' && !playMusicInfo.isTempPlay) addPlayedList(playMusicInfo as LX.Player.PlayMusicInfo)

  debouncePlay({ musicInfo, generation, operationId })
}

/**
 * 播放列表内歌曲
 * @param listId 列表id
 * @param id 歌曲id
 */
export const playMusicInfoNow = (musicInfo: LX.Player.PlayMusic, listId: string | null = null, alternativeMusicInfos?: LX.Music.MusicInfoOnline[]) => {
  setPlayMusicInfo(listId, musicInfo, true, { alternativeMusicInfos })
  void handlePlay()
}

/** Explicit selections use the existing FIFO queue and never continue an old playlist. */
export const playSelectedList = (list: LX.Player.PlayMusic[], listId: string | null = null) => {
  if (!list.length) return
  playerState.queueSession = null
  playerState.exclusiveBatch = true
  clearTempPlayeList()
  clearPlayedList()
  resetRandomNextMusicInfo()
  setPlayListId(null)
  playerActions.addTempPlayList(list.slice(1).map(musicInfo => ({ musicInfo, listId })))
  playMusicInfoNow(list[0], listId)
}

/** Reload a version without replacing the user's base playlist or FIFO remainder. */
export const reloadVersion = (musicInfo: LX.Music.MusicInfo, listId: string, context = playerState.playMusicInfo) => {
  setPlayMusicInfo(listId, musicInfo, context.isTempPlay, { alternativeMusicInfos: context.alternativeMusicInfos, recommendationSessionId: context.recommendationSessionId })
  void handlePlay()
}

export const playListById = async(listId: string, id: string) => {
  playerState.queueSession = null
  playerState.exclusiveBatch = false
  const prevListId = playerState.playInfo.playerListId
  setPlayListId(listId)
  const musicInfo = getList(listId).find(m => m.id == id)
  if (!musicInfo) return
  setPlayMusicInfo(listId, musicInfo)
  if (settingState.setting['player.isAutoCleanPlayedList'] || prevListId != listId) clearPlayedList()
  clearTempPlayeList()
  await handlePlay()
}

/**
 * 播放列表内歌曲
 * @param listId 列表id
 * @param index 播放的歌曲位置
 */
export const playList = async(listId: string, index: number) => {
  playerState.queueSession = null
  playerState.exclusiveBatch = false
  const prevListId = playerState.playInfo.playerListId
  setPlayListId(listId)
  setPlayMusicInfo(listId, getList(listId)[index])
  if (settingState.setting['player.isAutoCleanPlayedList'] || prevListId != listId) clearPlayedList()
  clearTempPlayeList()
  await handlePlay()
}

const handleToggleStop = async(reason: 'user' | 'ended' | 'error' | 'removed' = 'user') => {
  const generation = playerState.playbackGeneration
  const stopping = stop()
  const operationId = playerState.resourceOperationId
  await stopping
  setTimeout(() => {
    if (operationId !== playerState.resourceOperationId || generation !== playerState.playbackGeneration) return
    if (playerState.tempPlayList.length) {
      void playNext(false, reason)
      return
    }
    setPlayMusicInfo(null, null)
  })
}


let queueRevision = 0
const randomNextMusicInfo = {
  info: null as LX.Player.PlayMusicInfo | null,
  // index: -1,
}
export const resetRandomNextMusicInfo = () => {
  ++queueRevision
  if (randomNextMusicInfo.info) {
    randomNextMusicInfo.info = null
    // randomNextMusicInfo.index = -1
  }
}

export const getNextPlayMusicInfo = async(): Promise<LX.Player.PlayMusicInfo | null> => {
  const revision = queueRevision
  const generation = playerState.playbackGeneration
  if (playerState.tempPlayList.length) { // 如果稍后播放列表存在歌曲则直接播放改列表的歌曲
    const playMusicInfo = playerState.tempPlayList[0]
    return playMusicInfo
  }

  if (playerState.playMusicInfo.musicInfo == null) return null

  if (settingState.setting['player.togglePlayMethod'] === 'random' && randomNextMusicInfo.info) return randomNextMusicInfo.info

  const playMusicInfo = playerState.playMusicInfo
  const playInfo = playerState.playInfo
  // console.log(playInfo.playerListId)
  const currentListId = playInfo.playerListId
  if (!currentListId) return null
  const currentList = getList(currentListId)

  const playedList = settingState.setting['player.togglePlayMethod'] === 'random' ? playerState.playedList : []
  if (playedList.length) { // 移除已播放列表内不存在原列表的歌曲
    let currentId: string
    if (playMusicInfo.isTempPlay) {
      const musicInfo = currentList[playInfo.playerPlayIndex]
      if (musicInfo) currentId = musicInfo.id
    } else {
      currentId = playMusicInfo.musicInfo!.id
    }
    // 从已播放列表移除播放列表已删除的歌曲
    let index
    for (index = playedList.findIndex(m => m.musicInfo.id === currentId) + 1; index < playedList.length; index++) {
      const playMusicInfo = playedList[index]
      const currentId = playMusicInfo.musicInfo.id
      if (playMusicInfo.listId == currentListId && !currentList.some(m => m.id === currentId)) {
        removePlayedList(index)
        continue
      }
      break
    }

    if (index < playedList.length) return playedList[index]
  }
  // const isCheckFile = findNum > 2 // 针对下载列表，如果超过两次都碰到无效歌曲，则过滤整个列表内的无效歌曲
  let { filteredList, playerIndex } = await filterList({ // 过滤已播放歌曲
    listId: currentListId,
    list: currentList,
    playedList,
    playerMusicInfo: currentList[playInfo.playerPlayIndex],
    isNext: true,
  })

  if (revision !== queueRevision || generation !== playerState.playbackGeneration) return getNextPlayMusicInfo()
  if (playerState.tempPlayList.length) return playerState.tempPlayList[0]
  // Another preview/preload call may have populated this generation while we awaited filtering.
  if (settingState.setting['player.togglePlayMethod'] === 'random' && randomNextMusicInfo.info) return randomNextMusicInfo.info
  if (!filteredList.length) return null
  // let currentIndex: number = filteredList.indexOf(currentList[playInfo.playerPlayIndex])
  if (playerIndex == -1 && filteredList.length && !(playerState.queueSession && playInfo.playerPlayIndex === -1)) playerIndex = 0
  let nextIndex = playerIndex

  let togglePlayMethod = settingState.setting['player.togglePlayMethod']
  switch (togglePlayMethod) {
    case 'listLoop':
      nextIndex = playerIndex === filteredList.length - 1 ? 0 : playerIndex + 1
      break
    case 'random':
      nextIndex = getRandom(0, filteredList.length)
      break
    case 'list':
      nextIndex = playerIndex === filteredList.length - 1 ? -1 : playerIndex + 1
      break
    case 'singleLoop':
      nextIndex = Math.max(0, playerIndex)
      break
    default:
      return null
  }
  if (nextIndex < 0) return null

  const nextPlayMusicInfo = {
    musicInfo: filteredList[nextIndex],
    listId: currentListId,
    isTempPlay: false,
  }

  if (togglePlayMethod == 'random') {
    randomNextMusicInfo.info = nextPlayMusicInfo
    // randomNextMusicInfo.index = nextIndex
  }
  return nextPlayMusicInfo
}

const handlePlayNext = async(playMusicInfo: LX.Player.PlayMusicInfo, reason: 'user' | 'ended' | 'error' | 'removed' = 'user') => {
  setPlayMusicInfo(playMusicInfo.listId, playMusicInfo.musicInfo, playMusicInfo.isTempPlay, playMusicInfo, reason)
  await handlePlay()
}
/**
 * 下一曲
 * @param isAutoToggle 是否自动切换
 * @returns
 */
export const playNext = async(isAutoToggle = false, reason: 'user' | 'ended' | 'error' | 'removed' = isAutoToggle ? 'ended' : 'user'): Promise<void> => {
  const revision = queueRevision
  const generation = playerState.playbackGeneration
  if (playerState.tempPlayList.length) { // 如果稍后播放列表存在歌曲则直接播放改列表的歌曲
    const playMusicInfo = playerState.tempPlayList[0]
    removeTempPlayList(0)
    await handlePlayNext(playMusicInfo, reason)
    return
  }

  const playMusicInfo = playerState.playMusicInfo
  const playInfo = playerState.playInfo
  if (playMusicInfo.musicInfo == null) return handleToggleStop(reason)

  // console.log(playInfo.playerListId)
  const currentListId = playInfo.playerListId
  if (!currentListId) return handleToggleStop(reason)
  const currentList = getList(currentListId)

  const playedList = settingState.setting['player.togglePlayMethod'] === 'random' ? playerState.playedList : []

  if (playedList.length) { // 移除已播放列表内不存在原列表的歌曲
    let currentId: string
    if (playMusicInfo.isTempPlay) {
      const musicInfo = currentList[playInfo.playerPlayIndex]
      if (musicInfo) currentId = musicInfo.id
    } else {
      currentId = playMusicInfo.musicInfo.id
    }
    // 从已播放列表移除播放列表已删除的歌曲
    let index
    for (index = playedList.findIndex(m => m.musicInfo.id === currentId) + 1; index < playedList.length; index++) {
      const playMusicInfo = playedList[index]
      const currentId = playMusicInfo.musicInfo.id
      if (playMusicInfo.listId == currentListId && !currentList.some(m => m.id === currentId)) {
        removePlayedList(index)
        continue
      }
      break
    }

    if (index < playedList.length) {
      await handlePlayNext(playedList[index], reason)
      return
    }
  }
  if (settingState.setting['player.togglePlayMethod'] === 'random' && randomNextMusicInfo.info) {
    await handlePlayNext(randomNextMusicInfo.info, reason)
    return
  }
  // const isCheckFile = findNum > 2 // 针对下载列表，如果超过两次都碰到无效歌曲，则过滤整个列表内的无效歌曲
  let { filteredList, playerIndex } = await filterList({ // 过滤已播放歌曲
    listId: currentListId,
    list: currentList,
    playedList,
    playerMusicInfo: currentList[playInfo.playerPlayIndex],
    isNext: true,
  })

  if (generation !== playerState.playbackGeneration || currentListId !== playerState.playInfo.playerListId) return
  if (revision !== queueRevision || playerState.tempPlayList.length) return playNext(isAutoToggle, reason)
  if (!filteredList.length) return handleToggleStop(reason)
  // let currentIndex: number = filteredList.indexOf(currentList[playInfo.playerPlayIndex])
  if (playerIndex == -1 && filteredList.length && !(playerState.queueSession && playInfo.playerPlayIndex === -1)) playerIndex = 0
  let nextIndex = playerIndex

  let togglePlayMethod = settingState.setting['player.togglePlayMethod']
  if (!isAutoToggle) {
    switch (togglePlayMethod) {
      case 'list':
      case 'singleLoop':
      case 'none':
        togglePlayMethod = 'listLoop'
    }
  }
  switch (togglePlayMethod) {
    case 'listLoop':
      nextIndex = playerIndex === filteredList.length - 1 ? 0 : playerIndex + 1
      break
    case 'random':
      nextIndex = randomNextMusicInfo.info ? filteredList.findIndex(item => item.id === randomNextMusicInfo.info!.musicInfo.id) : -1
      if (nextIndex < 0) nextIndex = getRandom(0, filteredList.length)
      break
    case 'list':
      nextIndex = playerIndex === filteredList.length - 1 ? -1 : playerIndex + 1
      break
    case 'singleLoop':
      nextIndex = Math.max(0, playerIndex)
      break
    default:
      nextIndex = -1
      return
  }
  if (nextIndex < 0) return

  await handlePlayNext({
    musicInfo: filteredList[nextIndex],
    listId: currentListId,
    isTempPlay: false,
  }, reason)
}

/**
 * 上一曲
 */
export const playPrev = async(isAutoToggle = false): Promise<void> => {
  const revision = queueRevision
  const generation = playerState.playbackGeneration
  const playMusicInfo = playerState.playMusicInfo
  if (playMusicInfo.musicInfo == null) return handleToggleStop()
  const playInfo = playerState.playInfo

  const currentListId = playInfo.playerListId
  if (!currentListId) return handleToggleStop()
  const currentList = getList(currentListId)

  const playedList = settingState.setting['player.togglePlayMethod'] === 'random' ? playerState.playedList : []
  if (playedList.length) {
    let currentId: string
    if (playMusicInfo.isTempPlay) {
      const musicInfo = currentList[playInfo.playerPlayIndex]
      if (musicInfo) currentId = musicInfo.id
    } else {
      currentId = playMusicInfo.musicInfo.id
    }
    // 从已播放列表移除播放列表已删除的歌曲
    let index
    for (index = playedList.findIndex(m => m.musicInfo.id === currentId) - 1; index > -1; index--) {
      const playMusicInfo = playedList[index]
      const currentId = playMusicInfo.musicInfo.id
      if (playMusicInfo.listId == currentListId && !currentList.some(m => m.id === currentId)) {
        removePlayedList(index)
        continue
      }
      break
    }

    if (index > -1) {
      await handlePlayNext(playedList[index])
      return
    }
  }

  // const isCheckFile = findNum > 2
  let { filteredList, playerIndex } = await filterList({ // 过滤已播放歌曲
    listId: currentListId,
    list: currentList,
    playedList,
    playerMusicInfo: currentList[playInfo.playerPlayIndex],
    isNext: false,
  })
  if (generation !== playerState.playbackGeneration || currentListId !== playerState.playInfo.playerListId) return
  if (revision !== queueRevision) return playPrev(isAutoToggle)
  if (!filteredList.length) return handleToggleStop()

  // let currentIndex = filteredList.indexOf(currentList[playInfo.playerPlayIndex])
  if (playerIndex == -1 && filteredList.length) playerIndex = 0
  let nextIndex = playerIndex
  if (!playMusicInfo.isTempPlay) {
    let togglePlayMethod = settingState.setting['player.togglePlayMethod']
    if (!isAutoToggle) {
      switch (togglePlayMethod) {
        case 'list':
        case 'singleLoop':
        case 'none':
          togglePlayMethod = 'listLoop'
      }
    }
    switch (togglePlayMethod) {
      case 'random':
        nextIndex = getRandom(0, filteredList.length)
        break
      case 'listLoop':
      case 'list':
        nextIndex = playerIndex === 0 ? filteredList.length - 1 : playerIndex - 1
        break
      case 'singleLoop':
        break
      default:
        nextIndex = -1
        return
    }
    if (nextIndex < 0) return
  }


  await handlePlayNext({
    musicInfo: filteredList[nextIndex],
    listId: currentListId,
    isTempPlay: false,
  })
}

/**
 * 恢复播放
 */
export const play = () => {
  if (playerState.playMusicInfo.musicInfo == null) return
  if (isEmpty()) {
    if (createGettingUrlId(playerState.playMusicInfo.musicInfo) != global.lx.gettingUrlId) setMusicUrl(playerState.playMusicInfo.musicInfo)
    return
  }
  void setPlay()
}

/**
 * 暂停播放
 */
export const pause = async() => {
  await setPause()
}

/**
 * 停止播放
 */
export const stop = async() => {
  const generation = playerState.playbackGeneration
  const stopping = setStop()
  const operationId = playerState.resourceOperationId
  await stopping
  if (operationId !== playerState.resourceOperationId || generation !== playerState.playbackGeneration) return
  setTimeout(() => {
    // Clearing the stopped entry is allowed; a newer selection/resource owns its events.
    if (operationId !== playerState.resourceOperationId || (generation !== playerState.playbackGeneration && playerState.playMusicInfo.musicInfo)) return
    global.app_event.stop(undefined, true)
  })
}

/**
 * 播放、暂停播放切换
 */
export const togglePlay = () => {
  global.lx.isPlayedStop &&= false
  if (playerState.isPlay) {
    void pause()
  } else {
    play()
  }
}

/**
 * 收藏当前播放的歌曲
 */
export const collectMusic = () => {
  if (!playerState.playMusicInfo.musicInfo) return
  void addListMusics(LIST_IDS.LOVE, [
    'progress' in playerState.playMusicInfo.musicInfo
      ? playerState.playMusicInfo.musicInfo.metadata.musicInfo
      : playerState.playMusicInfo.musicInfo,
  ], settingState.setting['list.addMusicLocationType'])
}

/**
 * 取消收藏当前播放的歌曲
 */
export const uncollectMusic = () => {
  if (!playerState.playMusicInfo.musicInfo) return
  void removeListMusics(LIST_IDS.LOVE, [
    'progress' in playerState.playMusicInfo.musicInfo
      ? playerState.playMusicInfo.musicInfo.metadata.musicInfo.id
      : playerState.playMusicInfo.musicInfo.id,
  ])
}

/**
 * 不喜欢当前播放的歌曲
 */
export const dislikeMusic = async() => {
  const generation = playerState.playbackGeneration
  if (!playerState.playMusicInfo.musicInfo) return
  const minfo = 'progress' in playerState.playMusicInfo.musicInfo ? playerState.playMusicInfo.musicInfo.metadata.musicInfo : playerState.playMusicInfo.musicInfo
  await addDislikeInfo([{ name: minfo.name, singer: minfo.singer }])
  if (generation !== playerState.playbackGeneration) return
  await playNext(true)
}


// Queue edits are session-only. A saved playlist is never reordered or deleted here.
type QueueSection = 'pending' | 'base'
type QueueEntry = LX.Player.PlayMusicInfo | LX.Player.PlayMusic
const queueChanged = () => {
  resetRandomNextMusicInfo()
  global.state_event.playTempPlayListChanged({ ...playerState.tempPlayList })
}
const editableBaseQueue = () => {
  const listId = playerState.playInfo.playerListId
  if (!listId) return []
  if (!playerState.queueSession || playerState.queueSession.listId !== listId) {
    playerState.queueSession = { listId, list: [...getList(listId)] }
  }
  return playerState.queueSession.list
}
const queueList = (section: QueueSection): QueueEntry[] => section === 'pending' ? playerState.tempPlayList : editableBaseQueue()
const restoreQueueAnchor = (anchor?: LX.Player.PlayMusic) => {
  if (!anchor) return
  const index = getList(playerState.playInfo.playerListId).indexOf(anchor as never)
  playerActions.updatePlayIndex(playerState.playInfo.playIndex, index)
}
export const moveQueueItem = (section: QueueSection, entry: QueueEntry, direction: -1 | 1) => {
  const list = queueList(section)
  const from = list.indexOf(entry)
  const to = from + direction
  if (from < 0 || to < 0 || to >= list.length) return
  const anchor = getList(playerState.playInfo.playerListId)[playerState.playInfo.playerPlayIndex]
  list.splice(to, 0, list.splice(from, 1)[0])
  restoreQueueAnchor(anchor)
  queueChanged()
}
export const playQueueItem = async(section: QueueSection, entry: QueueEntry) => {
  const list = queueList(section)
  const index = list.indexOf(entry)
  if (index < 0) return // A stale row cannot select a different occurrence.
  if (section === 'pending') {
    const item = playerState.tempPlayList.splice(index, 1)[0]
    queueChanged()
    await handlePlayNext(item)
  } else {
    setPlayMusicInfo(playerState.playInfo.playerListId, entry as LX.Player.PlayMusic, false)
    await handlePlay()
  }
}
export const removeQueueItem = async(section: QueueSection, entry: QueueEntry) => {
  const list = queueList(section)
  const index = list.indexOf(entry)
  if (index < 0) return
  const anchor = getList(playerState.playInfo.playerListId)[playerState.playInfo.playerPlayIndex]
  const removingCurrent = section === 'base' && !playerState.playMusicInfo.isTempPlay && playerState.playMusicInfo.musicInfo === entry
  const following = section === 'base' ? list[index + 1] ?? list[0] : undefined
  list.splice(index, 1)
  if (section === 'base' && anchor === entry) {
    playerActions.updatePlayIndex(playerState.playInfo.playIndex, Math.max(-1, index - 1))
  } else restoreQueueAnchor(anchor)
  queueChanged()
  if (!removingCurrent) return
  if (playerState.tempPlayList.length) await playNext(false, 'removed')
  else if (following && following !== entry) await playQueueItem('base', following)
  else {
    const generation = playerState.playbackGeneration
    await stop()
    if (generation !== playerState.playbackGeneration) return
    if (playerState.tempPlayList.length) {
      await playNext(false, 'removed')
      return
    }
    setPlayMusicInfo(null, null)
  }
}
/** Keep the current audio; end after it instead of resuming a saved list or radio. */
export const clearPlaybackQueue = () => {
  playerState.exclusiveBatch = true
  clearTempPlayeList()
  clearPlayedList()
  setPlayListId(null)
  queueChanged()
}

export const queueItemNext = (section: QueueSection, entry: QueueEntry) => {
  const list = queueList(section)
  const index = list.indexOf(entry)
  if (index < 0) return
  if (section === 'pending') {
    const item = playerState.tempPlayList.splice(index, 1)[0]
    playerState.tempPlayList.unshift(item)
  } else playerActions.addTempPlayList([{ musicInfo: entry as LX.Player.PlayMusic, listId: playerState.playInfo.playerListId, isTop: true }])
  queueChanged()
}
