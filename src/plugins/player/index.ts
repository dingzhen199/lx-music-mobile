import TrackPlayer from 'react-native-track-player'
import { updateOptions, setVolume, setPlaybackRate, migratePlayerCache } from './utils'

// const listenEvent = () => {
//   TrackPlayer.addEventListener('playback-error', err => {
//     console.log('playback-error', err)
//   })
//   TrackPlayer.addEventListener('playback-state', info => {
//     console.log('playback-state', info)
//   })
//   TrackPlayer.addEventListener('playback-track-changed', info => {
//     console.log('playback-track-changed', info)
//   })
//   TrackPlayer.addEventListener('playback-queue-ended', info => {
//     console.log('playback-queue-ended', info)
//   })
// }

let initialization: Promise<void> | null = null
const initial = async({ volume, playRate, cacheSize, isHandleAudioFocus, isEnableAudioOffload }: {
  volume: number
  playRate: number
  cacheSize: number
  isHandleAudioFocus: boolean
  isEnableAudioOffload: boolean
}) => {
  if (initialization) return initialization
  if (global.lx.playerStatus.isInitialized) return
  global.lx.playerStatus.isIniting = true
  initialization = (async() => {
    console.log('Cache Size', cacheSize * 1024)
    await migratePlayerCache()
    await TrackPlayer.setupPlayer({
      maxCacheSize: cacheSize * 1024,
      maxBuffer: 1000,
      waitForBuffer: true,
      handleAudioFocus: isHandleAudioFocus,
      audioOffload: isEnableAudioOffload,
      autoUpdateMetadata: false,
    })
    await updateOptions()
    await setVolume(volume)
    await setPlaybackRate(playRate)
    global.lx.playerStatus.isInitialized = true
  })().finally(() => {
    global.lx.playerStatus.isIniting = false
    initialization = null
  })
  return initialization
}


const isInitialized = () => global.lx.playerStatus.isInitialized


export {
  initial,
  isInitialized,
  setVolume,
  setPlaybackRate,
}

export {
  setResource,
  setPause,
  setPlay,
  setCurrentTime,
  getDuration,
  getNativeTrackId,
  setStop,
  resetPlay,
  getPosition,
  updateMetaData,
  onStateChange,
  isEmpty,
  useBufferProgress,
  initTrackInfo,
} from './utils'
