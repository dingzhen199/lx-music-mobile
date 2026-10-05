import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AppEvent } from '@/event/appEvent'
import { StateEvent } from '@/event/stateEvent'
import actions from '@/store/player/action'
import state from '@/store/player/state'
import initLyric from './lyric'
import initStatus from './playStatus'
import initPlayer from './player'
const mocks = vi.hoisted(() => ({ play: vi.fn(), pause: vi.fn(), stop: vi.fn(), lyric: vi.fn(), metadata: vi.fn(), picture: vi.fn() }))
vi.mock('@/store/common/state', () => ({ default: {} }))
vi.mock('@/store/setting/state', () => ({ default: { setting: { 'player.isShowNotificationImage': true } } }))
vi.mock('@/core/common', () => ({ setNavActiveId: vi.fn(), updateSetting: vi.fn() }))
vi.mock('@/utils/listManage', () => ({ getListMusicSync: () => [] }))
vi.mock('@/utils', () => ({ arrPush: vi.fn(), arrUnshift: vi.fn(), formatPlayTime2: String }))
vi.mock('@/core/lyric', () => ({ init: async() => {}, toggleTranslation: async() => {}, toggleRoma: async() => {}, setPlaybackRate: async() => {}, play: mocks.play, pause: mocks.pause, stop: mocks.stop, setLyric: mocks.lyric }))
vi.mock('@/core/desktopLyric', () => ({ onDesktopLyricPositionChange: vi.fn(), onLyricLinePlay: vi.fn(), showDesktopLyric: async() => {}, showRemoteLyric: async() => {} }))
vi.mock('@/plugins/player/utils', () => ({ updateNowPlayingTitles: vi.fn() }))
vi.mock('@/plugins/player', () => ({ updateMetaData: mocks.metadata, setStop: async() => {} }))
vi.mock('@/plugins/player/playList', () => ({ delayUpdateMusicInfo: mocks.picture }))
vi.mock('@/core/player/player', () => ({ pause: async() => {}, playNext: async() => {} }))
let hub: AppEvent
const select = (id: string) => {
  actions.setPlayMusicInfo('owned', { id, source: 'wy', name: id, singer: '', interval: null, meta: {} } as LX.Music.MusicInfoOnline)
  actions.setMusicInfo({ id, name: id, pic: `${id}-cover` })
  actions.setIsPlay(true)
}
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers()
  hub = new AppEvent()
  vi.stubGlobal('app_event', hub); vi.stubGlobal('state_event', new StateEvent())
  vi.stubGlobal('lx', { isPlayedStop: false })
  select('a')
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
const lyricEvents = [['play', 'play'], ['pause', 'pause'], ['stop', 'stop'], ['error', 'pause'], ['musicToggled', 'stop'], ['lyricUpdated', 'lyric']] as const
it.each(lyricEvents)('old %s cannot control the next owner lyric projection', async(event, effect) => {
  await initLyric({} as LX.AppSetting)
  hub[event]()
  select('b')
  await vi.runAllTimersAsync()
  expect(mocks[effect]).not.toHaveBeenCalled()
})
it.each(lyricEvents)('current %s still updates lyric projection', async(event, effect) => {
  await initLyric({} as LX.AppSetting)
  hub[event]()
  await vi.runAllTimersAsync()
  expect(mocks[effect]).toHaveBeenCalledOnce()
})
it('normal stop still clears lyrics after current playback is cleared', async() => {
  await initLyric({} as LX.AppSetting)
  hub.stop()
  actions.setPlayMusicInfo(null, null)
  await vi.runAllTimersAsync()
  expect(mocks.stop).toHaveBeenCalledOnce()
})
it.each(['play', 'pause', 'stop'] as const)('old %s cannot refresh notification state for a newer owner', async(event) => {
  initStatus()
  if (event !== 'play') { hub.play(); await vi.runAllTimersAsync(); mocks.metadata.mockClear() }
  hub[event]()
  select('b')
  await vi.runAllTimersAsync()
  expect(mocks.metadata).not.toHaveBeenCalled()
  hub[event](); await vi.runAllTimersAsync()
  expect(mocks.metadata).toHaveBeenCalledWith(state.musicInfo, true)
})
it('old picture-update delivery cannot refresh a new owner notification', async() => {
  await initPlayer({} as LX.AppSetting)
  hub.picUpdated()
  select('b')
  await vi.runAllTimersAsync()
  expect(mocks.picture).not.toHaveBeenCalled()
  hub.picUpdated(); await vi.runAllTimersAsync()
  expect(mocks.picture).toHaveBeenCalledWith(state.musicInfo)
})
