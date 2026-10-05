import { setNavActiveId } from '@/core/common'
import Event from './Event'
import commonState from '@/store/common/state'
import playerState from '@/store/player/state'
import { type Source as SonglistSource } from '@/store/songlist/state'
import { type SearchType } from '@/store/search/state'


// {
//   // sync: {
//   //   send_action_list: 'send_action_list',
//   //   handle_action_list: 'handle_action_list',
//   //   send_sync_list: 'send_sync_list',
//   //   handle_sync_list: 'handle_sync_list',
//   // },
// }

export class AppEvent extends Event {
  private emitPlayback(eventName: string, generation: number, ...args: unknown[]) {
    if (generation !== playerState.playbackGeneration) return
    this.emit(eventName, ...args, generation)
  }

  private emitNativePlayback(eventName: string, generation: number, isResourceCurrent?: () => boolean) {
    this.emitGuarded(eventName, () => generation === playerState.playbackGeneration && (!isResourceCurrent || isResourceCurrent()), generation)
  }

  // configUpdate() {
  //   this.emit('configUpdate')
  // }

  focus() {
    this.emit('focus')
  }

  /**
   * 我的列表更新
   */
  mylistUpdated(lists: Array<LX.List.MyDefaultListInfo | LX.List.MyLoveListInfo | LX.List.UserListInfo>) {
    this.emit('mylistUpdated', lists)
  }

  /**
   * 我的列表切换
   */
  mylistToggled(id: string) {
    this.emit('listToggled', id)
  }

  /**
   * 音乐信息切换
   */
  musicToggled(reason: 'user' | 'ended' | 'error' | 'removed' = 'user', generation = playerState.playbackGeneration) {
    this.emitPlayback('musicToggled', generation, reason)
  }

  /**
   * 手动改变进度
   * @param progress 进度
   */
  setProgress(progress: number, maxPlayTime?: number, generation = playerState.playbackGeneration) {
    this.emitPlayback('setProgress', generation, progress, maxPlayTime)
  }

  /**
   * 设置音量大小
   * @param volume 音量大小
   */
  setVolume(volume: number) {
    this.emit('setVolume', volume)
  }

  /**
   * 设置是否静音
   * @param isMute 是否静音
   */
  setVolumeIsMute(isMute: boolean) {
    this.emit('setVolumeIsMute', isMute)
  }

  // 播放器事件
  play(generation = playerState.playbackGeneration, isResourceCurrent?: () => boolean) {
    this.emitNativePlayback('play', generation, isResourceCurrent)
  }

  pause(generation = playerState.playbackGeneration, isResourceCurrent?: () => boolean) {
    this.emitNativePlayback('pause', generation, isResourceCurrent)
  }

  stop(generation = playerState.playbackGeneration, nativeStopped = false) {
    if (generation !== playerState.playbackGeneration) return
    const operationId = playerState.resourceOperationId
    this.emitGuarded('stop', () => (generation === playerState.playbackGeneration || !playerState.playMusicInfo.musicInfo) &&
      (!nativeStopped || operationId === playerState.resourceOperationId), generation, nativeStopped)
  }

  error(generation = playerState.playbackGeneration, isResourceCurrent?: () => boolean) {
    this.emitNativePlayback('error', generation, isResourceCurrent)
  }

  // 播放器原始事件
  playerPlaying(generation = playerState.playbackGeneration, isResourceCurrent?: () => boolean) {
    this.emitNativePlayback('playerPlaying', generation, isResourceCurrent)
  }

  playerPause(generation = playerState.playbackGeneration, isResourceCurrent?: () => boolean) {
    this.emitNativePlayback('playerPause', generation, isResourceCurrent)
  }

  // playerStop() {
  //   this.emit('playerStop')
  // }

  playerEnded(generation = playerState.playbackGeneration, isResourceCurrent?: () => boolean) {
    this.emitNativePlayback('playerEnded', generation, isResourceCurrent)
  }

  playerError(generation = playerState.playbackGeneration, isResourceCurrent?: () => boolean) {
    this.emitNativePlayback('playerError', generation, isResourceCurrent)
  }

  playerLoadeddata(generation = playerState.playbackGeneration, isResourceCurrent?: () => boolean) {
    this.emitNativePlayback('playerLoadeddata', generation, isResourceCurrent)
  }

  loveListMusicsAdded(musics: LX.Music.MusicInfo[]) {
    this.emit('loveListMusicsAdded', musics)
  }

  playerLoadstart(generation = playerState.playbackGeneration, isResourceCurrent?: () => boolean) {
    this.emitNativePlayback('playerLoadstart', generation, isResourceCurrent)
  }

  // playerCanplay() {
  //   this.emit('playerCanplay')
  // }

  playerEmptied(generation = playerState.playbackGeneration, isResourceCurrent?: () => boolean) {
    this.emitNativePlayback('playerEmptied', generation, isResourceCurrent)
  }

  playerWaiting(generation = playerState.playbackGeneration, isResourceCurrent?: () => boolean) {
    this.emitNativePlayback('playerWaiting', generation, isResourceCurrent)
  }


  // 更新图片事件
  picUpdated(generation = playerState.playbackGeneration) {
    this.emitPlayback('picUpdated', generation)
  }

  // 更新歌词事件
  lyricUpdated(generation = playerState.playbackGeneration) {
    this.emitPlayback('lyricUpdated', generation)
  }

  // 更新歌词偏移
  lyricOffsetUpdate() {
    this.emit('lyricOffsetUpdate')
  }

  // 我的列表内歌曲改变事件
  myListMusicUpdate(ids: string[]) {
    if (!ids.length) return
    this.emit('myListMusicUpdate', ids)
  }

  // 下载列表改变事件
  downloadListUpdate() {
    this.emit('downloadListUpdate')
  }

  // 列表里的音乐信息改变事件
  musicInfoUpdate(musicInfo: LX.Music.MusicInfo) {
    this.emit('musicInfoUpdate', musicInfo)
  }

  changeMenuVisible(visible: boolean) {
    this.emit('changeMenuVisible', visible)
  }

  /**
   * 搜索类型改变事件
   * @param type
   */
  searchTypeChanged(type: SearchType) {
    this.emit('searchTypeChanged', type)
  }

  jumpListPosition() {
    if (commonState.navActiveId == 'nav_love') {
      this.emit('jumpListPosition')
    } else {
      global.lx.jumpMyListPosition = true
      setNavActiveId('nav_love')
      setTimeout(() => {
        this.emit('jumpListPosition')
      }, 200)
    }
  }

  changeLoveListVisible(visible: boolean) {
    this.emit('changeLoveListVisible', visible)
  }

  showSonglistTagList(source: SonglistSource, activeId: string) {
    this.emit('showSonglistTagList', source, activeId)
  }

  hideSonglistTagList() {
    this.emit('hideSonglistTagList')
  }

  songlistTagInfoChange(name: string, id: string) {
    this.emit('songlistTagInfoChange', name, id)
  }

  selectSyncMode(mode: LX.Sync.ModeType) {
    this.emit('selectSyncMode', mode)
  }
}


type EventMethods = Omit<EventType, keyof Event>


declare class EventType extends AppEvent {
  on<K extends keyof EventMethods>(event: K, listener: EventMethods[K]): any
  off<K extends keyof EventMethods>(event: K, listener: EventMethods[K]): any
}

export type AppEventTypes = Omit<EventType, keyof Omit<Event, 'on' | 'off' | 'onSync' | 'offSync'>>
export const createAppEventHub = (): AppEventTypes => {
  return new AppEvent()
}
