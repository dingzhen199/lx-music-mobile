const resolvedMocks = vi.hoisted(() => ({ url: vi.fn(), resource: vi.fn(), toast: vi.fn() }))
vi.mock('@/store/common/state', () => ({ default: { fontSize: 1, navActiveId: 'nav_search' } }))
vi.mock('@/core/common', () => ({ setNavActiveId: vi.fn() }))
vi.mock('react-native', () => ({ Dimensions: { get: () => ({ width: 400, height: 800 }) }, Platform: { OS: 'android', select: (v: any) => v.android }, PixelRatio: { get: () => 1, getFontScale: () => 1, roundToNearestPixel: (n: number) => n } }))
import { beforeEach, expect, it, vi } from 'vitest'
import { StateEvent } from '@/event/stateEvent'
import { AppEvent } from '@/event/appEvent'
vi.mock('@/store/setting/state', () => ({ default: { setting: { 'player.togglePlayMethod': 'list' } } }))
vi.mock('@/utils/common', () => ({ getRandom: () => 0 }))
vi.mock('@/utils', () => ({ arrPush: (a: unknown[], b: unknown[]) => a.push(...b), arrUnshift: (a: unknown[], b: unknown[]) => a.unshift(...b), formatPlayTime2: String }))
vi.mock('@/plugins/player', () => ({ isInitialized: () => true, setStop: async() => {}, setPause: vi.fn(), setPlay: vi.fn(), setResource: resolvedMocks.resource }))
vi.mock('@/core/music', () => ({ getMusicUrl: resolvedMocks.url, getPicPath: vi.fn(), getLyricInfo: vi.fn() }))
vi.mock('@/utils/tools', () => ({ debounceBackgroundTimer: () => () => {}, toast: resolvedMocks.toast }))
const listMocks = vi.hoisted(() => ({ list: [] as any[] }))
vi.mock('@/utils/listManage', () => ({ getListMusicSync: () => listMocks.list }))
vi.mock('@/core/player/progress', () => ({ setProgress: vi.fn() }))
vi.mock('@/core/list', () => ({ addListMusics: vi.fn(), removeListMusics: vi.fn(), updateListMusics: async([{musicInfo}]: any) => { const i=listMocks.list.findIndex(s=>s.id===musicInfo.id); listMocks.list[i]=musicInfo } }))
vi.mock('@/core/dislikeList', () => ({ addDislikeInfo: vi.fn() }))
vi.mock('@/core/player/utils', () => ({ filterList: vi.fn(async() => ({ filteredList: listMocks.list, playerIndex: 0 })) }))
vi.mock('react-native-background-timer', () => ({ default: { setTimeout: () => 1, clearTimeout: vi.fn() } }))
import actions from '@/store/player/action'
import state from '@/store/player/state'
import { playSelectedList, playNext, getNextPlayMusicInfo, setMusicUrl } from '@/core/player/player'
const song = (id: string) => ({ id, source: 'wy', name: id, singer: '', interval: null, meta: {} }) as LX.Music.MusicInfoOnline
beforeEach(() => {
  vi.stubGlobal('state_event', new StateEvent()); vi.stubGlobal('app_event', new AppEvent())
  vi.stubGlobal('lx', { isPlayedStop: false, restorePlayInfo: null })
  vi.stubGlobal('i18n', { t: (key: string) => key })
  vi.clearAllMocks()
  state.isPlay = false
  actions.setPlayListId('old'); actions.clearTempPlayeList(); actions.clearPlayedList()
})

vi.mock('@/utils/musicSdk', () => ({ default: {} }))
vi.mock('@/utils/data', () => ({}))
import { handleToggleSource } from '@/screens/Home/Views/Mylist/MusicList/listAction'
it('changing selected A version keeps only pending selected C', async() => {
 const a=song('a'), b=song('b'), c=song('c'), d=song('d')
 listMocks.list=[a,b,c,d]
 playSelectedList([a,c],'owned')
 await handleToggleSource('owned',a,song('version-b'))
 expect(state.playInfo.playerListId).toBeNull()
 expect(state.tempPlayList.map(item=>item.musicInfo.id)).toEqual(['c'])
})

it('ordinary sequential playback ignores history left by random mode', async() => {
  const a = song('a'), b = song('b'), c = song('c')
  listMocks.list = [a, b, c]
  state.exclusiveBatch = false
  actions.setPlayListId('owned')
  actions.setPlayMusicInfo('owned', a, false)
  state.playInfo.playerPlayIndex = 0
  state.playedList = [a, c, b].map(musicInfo => ({ musicInfo, listId: 'owned', isTempPlay: false }))
  expect((await getNextPlayMusicInfo())?.musicInfo.id).toBe('b')
  await playNext()
  expect(state.playMusicInfo.musicInfo?.id).toBe('b')
})
it('changing a queued version retains position and other queue metadata', () => {
  const a = song('a'), c = song('c')
  playSelectedList([a, c], 'owned')
  const changed = { ...c, meta: { ...c.meta, toggleMusicInfo: song('new-c') } } as LX.Music.MusicInfoOnline
  actions.updateQueuedVersion('owned', changed)
  expect(state.tempPlayList.map(item => item.musicInfo.id)).toEqual(['c'])
  expect(state.tempPlayList[0].musicInfo).toBe(changed)
})
