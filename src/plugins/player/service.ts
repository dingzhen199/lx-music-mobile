/* eslint-disable @typescript-eslint/no-misused-promises */
import TrackPlayer, { State as TPState, Event as TPEvent } from 'react-native-track-player'
// import { store } from '@/store'
// import { action as playerAction, STATUS } from '@/store/modules/player'
import { isTempId } from './utils'
// import { play as lrcPlay, pause as lrcPause } from '@/core/lyric'
import { exitApp } from '@/core/common'
import { getCurrentTrackId, isCurrentResourceEnd, getInstalledResource } from './playList'
import { pause, play, playNext, playPrev } from '@/core/player/player'
import playerState from '@/store/player/state'

type PlaybackEvent = 'play' | 'pause' | 'error' | 'playerPlaying' | 'playerPause' | 'playerEnded' | 'playerError' | 'playerLoadstart' | 'playerEmptied' | 'playerWaiting'
const capturePlaybackOwner = () => {
  const generation = playerState.playbackGeneration
  const musicInfo = playerState.playMusicInfo.musicInfo
  const resourceTrackId = playerState.resourceTrackId
  const resource = getInstalledResource()
  const operationId = playerState.resourceOperationId
  const isCurrent = () => operationId === playerState.resourceOperationId && generation === playerState.playbackGeneration && musicInfo === playerState.playMusicInfo.musicInfo && resourceTrackId === playerState.resourceTrackId
  return {
    generation,
    resource,
    isCurrent,
    emit(event: PlaybackEvent) {
      if (isCurrent()) global.app_event[event](generation, () => isCurrent() && resource !== null && getInstalledResource() === resource)
    },
  }
}

const readInstalledOwner = async() => {
  const owner = capturePlaybackOwner()
  if (!owner.resource) return null
  try {
    const trackId = await getCurrentTrackId()
    if (!owner.isCurrent() || getInstalledResource() !== owner.resource || trackId !== owner.resource.audioId) return null
    return owner
  } catch (error) {
    if (owner.isCurrent()) console.warn('Native resource identity unavailable', error)
    return null
  }
}

let isInitialized = false

// let retryTrack: LX.Player.Track | null = null
// let retryGetUrlId: string | null = null
// let retryGetUrlNum = 0
// let errorTime = 0
// let prevDuration = 0
// let isPlaying = false

// 销毁播放器并退出
const handleExitApp = async(reason: string) => {
  global.lx.isPlayedStop = false
  exitApp(reason)
}


const registerPlaybackService = async() => {
  if (isInitialized) return

  console.log('reg services...')
  TrackPlayer.addEventListener(TPEvent.RemotePlay, () => {
    // console.log('remote-play')
    play()
  })

  TrackPlayer.addEventListener(TPEvent.RemotePause, () => {
    // console.log('remote-pause')
    void pause()
  })

  TrackPlayer.addEventListener(TPEvent.RemoteNext, () => {
    // console.log('remote-next')
    void playNext()
  })

  TrackPlayer.addEventListener(TPEvent.RemotePrevious, () => {
    // console.log('remote-previous')
    void playPrev()
  })

  TrackPlayer.addEventListener(TPEvent.RemoteStop, () => {
    // console.log('remote-stop')
    void handleExitApp('Remote Stop')
  })

  // TrackPlayer.addEventListener(TPEvent.RemoteDuck, async({ permanent, paused, ducking }) => {
  //   console.log('remote-duck')
  //   if (paused) {
  //     store.dispatch(playerAction.setStatus({ status: STATUS.pause, text: '已暂停' }))
  //     lrcPause()
  //   } else {
  //     store.dispatch(playerAction.setStatus({ status: STATUS.playing, text: '播放中...' }))
  //     TrackPlayer.getPosition().then(position => {
  //       lrcPlay(position * 1000)
  //     })
  //   }
  // })

  TrackPlayer.addEventListener(TPEvent.PlaybackError, async(err: any) => {
    const owner = await readInstalledOwner()
    if (!owner) return
    console.log('playback-error', err)
    owner.emit('error')
    owner.emit('playerError')
  })

  TrackPlayer.addEventListener(TPEvent.RemoteSeek, async({ position }) => {
    const owner = capturePlaybackOwner()
    if (owner.isCurrent()) global.app_event.setProgress(position as number, undefined, owner.generation)
  })

  TrackPlayer.addEventListener(TPEvent.PlaybackState, async info => {
    const owner = await readInstalledOwner()
    if (!owner || global.lx.gettingUrlId || isTempId()) return
    // let currentIsPlaying = false

    switch (info.state) {
      case TPState.None:
        // console.log('state', 'State.NONE')
        break
      case TPState.Ready:
      case TPState.Stopped:
      case TPState.Paused:
        owner.emit('playerPause')
        owner.emit('pause')
        break
      case TPState.Playing:
        owner.emit('playerPlaying')
        owner.emit('play')
        break
      case TPState.Buffering:
        owner.emit('pause')
        owner.emit('playerWaiting')
        break
      case TPState.Connecting:
        owner.emit('playerLoadstart')
        break
      default:
        // console.log('playback-state', info)
        break
    }
    if (owner.isCurrent() && global.lx.isPlayedStop) return handleExitApp('Timeout Exit')

    // console.log('currentIsPlaying', currentIsPlaying, global.lx.playInfo.isPlaying)
    // void updateMetaData(global.lx.store_playMusicInfo.musicInfo, currentIsPlaying)
  })
  TrackPlayer.addEventListener(TPEvent.PlaybackTrackChanged, async info => {
    const owner = capturePlaybackOwner()
    let trackId: Awaited<ReturnType<typeof getCurrentTrackId>>
    try {
      trackId = await getCurrentTrackId()
    } catch (error) {
      if (owner.isCurrent()) console.warn('Native track identity unavailable', error)
      return
    }
    // Missing identity is not proof of a natural end. Do not map numeric event indices to songs.
    if (!owner.isCurrent() || typeof trackId !== 'string' || !trackId) return
    global.lx.playerTrackId = trackId
    if (info.track == null) return
    const isResourceEnd = isCurrentResourceEnd(trackId, owner.generation)
    if (global.lx.isPlayedStop && (isResourceEnd || trackId === playerState.resourceTrackId)) return handleExitApp('Timeout Exit')

    if (isResourceEnd) {
      try {
        await TrackPlayer.pause()
      } catch (error) {
        if (owner.isCurrent()) console.warn('Native end pause failed', error)
        return
      }
      if (!owner.isCurrent() || !isCurrentResourceEnd(trackId, owner.generation)) return
      const emitEnd = (event: PlaybackEvent) => {
        if (isCurrentResourceEnd(trackId, owner.generation)) owner.emit(event)
      }
      emitEnd('playerPause')
      emitEnd('pause')
      emitEnd('playerEnded')
      emitEnd('playerEmptied')
    }
  })
  // TrackPlayer.addEventListener('playback-queue-ended', async info => {
  //   // console.log('playback-queue-ended', info)
  //   store.dispatch(playerAction.playNext())
  //   // if (!info.nextTrack) return
  //   // const track = await TrackPlayer.getTrack(info.nextTrack)
  //   // if (!track) return
  //   // // if (track.url == defaultUrl) {
  //   // //   TrackPlayer.pause()
  //   // //   getMusicUrl(track.original).then(url => {
  //   // //     TrackPlayer.updateMetadataForTrack(info.nextTrack, {
  //   // //       url,
  //   // //     })
  //   // //     TrackPlayer.play()
  //   // //   })
  //   // // }
  //   // if (!track.artwork) {
  //   //   getMusicPic(track.original).then(url => {
  //   //     console.log(url)
  //   //     TrackPlayer.updateMetadataForTrack(info.nextTrack, {
  //   //       artwork: url,
  //   //     })
  //   //   })
  //   // }
  // })
  // TrackPlayer.addEventListener('playback-destroy', async() => {
  //   console.log('playback-destroy')
  //   store.dispatch(playerAction.destroy())
  // })
  isInitialized = true
}


export default () => {
  if (global.lx.playerStatus.isRegisteredService) return
  console.log('handle registerPlaybackService...')
  TrackPlayer.registerPlaybackService(() => registerPlaybackService)
  global.lx.playerStatus.isRegisteredService = true
}
