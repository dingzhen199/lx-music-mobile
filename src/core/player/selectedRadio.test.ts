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
vi.mock('@/utils/listManage', () => ({ getListMusicSync: () => [] }))
vi.mock('@/core/player/progress', () => ({ setProgress: vi.fn() }))
vi.mock('@/core/list', () => ({ addListMusics: vi.fn(), removeListMusics: vi.fn() }))
vi.mock('@/core/dislikeList', () => ({ addDislikeInfo: vi.fn() }))
vi.mock('@/core/player/utils', () => ({ filterList: vi.fn() }))
vi.mock('react-native-background-timer', () => ({ default: { setTimeout: () => 1, clearTimeout: vi.fn() } }))
import actions from '@/store/player/action'
import state from '@/store/player/state'
import { playSelectedList, playMusicInfoNow } from '@/core/player/player'
const song = (id: string) => ({ id, source: 'wy', name: id, singer: '', interval: null, meta: {} }) as LX.Music.MusicInfoOnline
beforeEach(() => {
  vi.stubGlobal('state_event', new StateEvent()); vi.stubGlobal('app_event', new AppEvent())
  vi.stubGlobal('lx', { isPlayedStop: false, restorePlayInfo: null })
  vi.stubGlobal('i18n', { t: (key: string) => key })
  vi.clearAllMocks()
  state.isPlay = false
  state.exclusiveBatch = false
  actions.setPlayListId('old'); actions.clearTempPlayeList(); actions.clearPlayedList()
})

const radioMocks = vi.hoisted(() => ({ setting: { 'recommend.radio': true, 'recommend.radius': 50, 'recommend.autoRefill': true }, explore: vi.fn() }))
vi.mock('@/core/recommend/adapters/setting', () => ({ appSetting: radioMocks.setting }))
vi.mock('@/core/recommend/engine', () => ({ exploreOnce: vi.fn() }))
vi.mock('@/core/recommend/platformEngine', () => ({ explorePlatformOnce: radioMocks.explore }))
vi.mock('@/core/recommend/feature', () => ({ startFeatureCollection: vi.fn(), stopFeatureCollection: vi.fn() }))
vi.mock('@/core/recommend/profile', () => ({ getProfileState: () => null, onProfileSignal: vi.fn(), recordRecommendedSkip: vi.fn() }))
vi.mock('@/core/recommend/submission', () => ({ filterForSubmission: async(result: unknown) => result }))
vi.mock('@/utils/data', () => ({ getRecommendMetrics: async() => null, saveRecommendMetrics: vi.fn() }))
import { initRecommendRadio, startSession, endSession } from '@/core/recommend/session'
import { syncRecommendPlayer } from '@/core/recommend/adapters/playerState'
it('selected batch remains exclusive with radio enabled', async() => {
  vi.useFakeTimers()
  global.state_event.onSync('playMusicInfoChanged', syncRecommendPlayer)
  global.state_event.onSync('playTempPlayListChanged', syncRecommendPlayer)
  radioMocks.explore.mockResolvedValue({ engine: 'platform', candidates: [{ artist:'Radio Artist', title:'Radio song', reason:'radio', musicInfo: song('radio') }], meta: { state: 'ok', providers: [] } })
  initRecommendRadio()
  playSelectedList([song('selected-a'), song('selected-b')], 'owned')
  await vi.advanceTimersByTimeAsync(1500)
  const pending = state.tempPlayList.map(item => item.musicInfo.id)
  console.log('actual pending after selected batch', pending)
  endSession()
  vi.useRealTimers()
  expect(pending).toEqual(['selected-b'])
})

it('late recommendation result cannot append after explicit selection cancels its run', async() => {
  global.state_event.onSync('playMusicInfoChanged', syncRecommendPlayer)
  global.state_event.onSync('playTempPlayListChanged', syncRecommendPlayer)
  let finish!: (value: unknown) => void
  radioMocks.explore.mockImplementationOnce(async() => new Promise(resolve => { finish = resolve }))
  playMusicInfoNow(song('anchor'))
  const pending = startSession()
  await vi.waitFor(() => { expect(finish).toBeTypeOf('function') })
  playSelectedList([song('chosen-a'), song('chosen-b')], 'owned')
  finish({ engine: 'platform', candidates: [{ artist: 'Radio Artist', title: 'Late', musicInfo: song('late') }], meta: { state: 'ok', providers: [] } })
  await pending
  expect(state.tempPlayList.map(item => item.musicInfo.id)).toEqual(['chosen-b'])
  endSession()
})
it('explicit station restart releases batch suppression without changing persisted radio preference', async() => {
  global.state_event.onSync('playMusicInfoChanged', syncRecommendPlayer)
  global.state_event.onSync('playTempPlayListChanged', syncRecommendPlayer)
  playSelectedList([song('selected')], 'owned')
  radioMocks.explore.mockResolvedValue({ engine: 'platform', candidates: [], meta: { state: 'empty', providers: [] } })
  await startSession()
  expect(state.exclusiveBatch).toBe(false)
  expect(radioMocks.setting['recommend.radio']).toBe(true)
  endSession()
})
