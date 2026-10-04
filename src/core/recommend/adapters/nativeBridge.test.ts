import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { StateEvent } from '@/event/stateEvent'
import { AppEvent } from '@/event/appEvent'
vi.mock('@/store/common/state', () => ({ default: { fontSize: 1, navActiveId: 'nav_search' } }))
vi.mock('@/core/common', () => ({ setNavActiveId: vi.fn() }))
vi.mock('@/utils', () => ({ arrPush: (a: unknown[], b: unknown[]) => a.push(...b), arrUnshift: (a: unknown[], b: unknown[]) => a.unshift(...b), formatPlayTime2: String }))
let actions: typeof import('@/store/player/action').default
let state: typeof import('@/store/player/state').default
let bridge: typeof import('./playerState')
let hub: AppEvent
const song = (id: string) => ({ id, source: 'wy', name: id, singer: 'Artist', meta: {}, interval: null }) as LX.Music.MusicInfoOnline
beforeEach(async() => {
  vi.resetModules()
  vi.useFakeTimers()
  hub = new AppEvent()
  vi.stubGlobal('app_event', hub)
  vi.stubGlobal('state_event', new StateEvent())
  actions = (await import('@/store/player/action')).default
  state = (await import('@/store/player/state')).default
  bridge = await import('./playerState')
  ;(await import('./init')).initRecommendAdapters()
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
it('real store → synchronous state bridge clears recommendation identity before the next track event', () => {
  const seen: unknown[] = []
  hub.onSync('musicToggled', () => seen.push({ ...bridge.playMusicInfo }))
  const a = song('a'); const b = song('b'); const alt = song('alt')
  actions.setPlayMusicInfo(null, a, true, { alternativeMusicInfos: [alt], recommendationSessionId: 7 })
  hub.musicToggled()
  actions.setPlayMusicInfo('owned', b)
  hub.musicToggled()
  actions.setPlayMusicInfo('owned', a)
  hub.musicToggled()
  expect(seen).toMatchObject([
    { musicInfo: { id: 'a' }, alternativeMusicInfos: [alt], recommendationSessionId: 7 },
    { musicInfo: { id: 'b' }, alternativeMusicInfos: undefined, recommendationSessionId: undefined },
    { musicInfo: { id: 'a' }, alternativeMusicInfos: undefined, recommendationSessionId: undefined },
  ])
  expect(state.playbackGeneration).toBe(3)
})
it('existing UI delivery remains asynchronous and observer exceptions do not prevent it', async() => {
  const ui = vi.fn(); const sync = vi.fn()
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  hub.on('play', ui)
  hub.onSync('play', () => { throw new Error('observer') })
  hub.onSync('play', sync)
  hub.play()
  expect(sync).toHaveBeenCalledOnce()
  expect(ui).not.toHaveBeenCalled()
  await vi.runAllTimersAsync()
  expect(ui).toHaveBeenCalledOnce()
  warn.mockRestore()
})
it('synchronous unsubscribe and snapshot iteration tolerate reentrant observer changes', () => {
  const second = vi.fn()
  const first = () => { hub.offSync('play', second) }
  hub.onSync('play', first); hub.onSync('play', second)
  hub.play(); hub.play()
  expect(second).toHaveBeenCalledOnce()
  hub.offAll('play')
  hub.play()
  expect(second).toHaveBeenCalledOnce()
})
it('queue metadata survives the real queue action and removal is reflected immediately', () => {
  actions.addTempPlayList([{ listId: null, musicInfo: song('a'), alternativeMusicInfos: [song('alt')], recommendationSessionId: 4 }])
  expect(bridge.tempPlayList[0]).toMatchObject({ alternativeMusicInfos: [{ id: 'alt' }], recommendationSessionId: 4 })
  actions.removeTempPlayList(0)
  expect(bridge.tempPlayList).toHaveLength(0)
})
it('deferred duration cannot bind to B or a repeated A generation', async() => {
  const { readCurrentPlayback } = await import('@/core/player/readCurrentPlayback')
  let finish!: (value: number) => void
  actions.setPlayMusicInfo('owned', song('a'))
  state.resourceTrackId = 'a-1'
  const old = readCurrentPlayback(async() => new Promise<number>(resolve => { finish = resolve }), async() => 'a-1')
  await vi.advanceTimersByTimeAsync(0)
  actions.setPlayMusicInfo('owned', song('b'))
  actions.setPlayMusicInfo('owned', song('a'))
  finish(200)
  expect(await old).toBeNull()
  state.resourceTrackId = 'a-2'
  expect(await readCurrentPlayback(async() => 100, async() => 'a-2')).toBe(100)
})
it('same-tick settings/play/pause observers see the new rate before lifecycle callbacks', async() => {
  const settings = (await import('@/store/setting/state')).default
  const { playbackRate } = await import('./playbackRate')
  const observed: Array<[string, number]> = []
  hub.onSync('play', () => { observed.push(['play', playbackRate.value]) })
  hub.onSync('pause', () => { observed.push(['pause', playbackRate.value]) })
  settings.setting['player.playbackRate'] = 2
  global.state_event.configUpdated(['player.playbackRate'], { 'player.playbackRate': 2 })
  hub.play()
  settings.setting['player.playbackRate'] = 0.5
  global.state_event.configUpdated(['player.playbackRate'], { 'player.playbackRate': 0.5 })
  hub.pause()
  expect(observed).toEqual([['play', 2], ['pause', 0.5]])
})
it('provider writeback preserves resource identity and generation without a synthetic song-change event', () => {
  const original = song('original'); const resolved = song('resolved')
  actions.setPlayMusicInfo('owned', original)
  state.resourceMusicId = original.id
  const generation = state.playbackGeneration
  const toggled = vi.fn(); hub.onSync('musicToggled', toggled)
  actions.replacePlayMusicInfo('owned', original, resolved)
  expect(bridge.playMusicInfo.musicInfo?.id).toBe('resolved')
  expect(state.resourceMusicId).toBe('original')
  expect(state.playbackGeneration).toBe(generation)
  expect(toggled).not.toHaveBeenCalled()
})
vi.mock('@/utils/data', () => ({ getRecommendProfile: async() => null, saveRecommendProfile: vi.fn() }))
vi.mock('@/core/recommend/llm', () => ({ llmComplete: vi.fn() }))
it.each([false, true])('real error/playerError stream pauses profile listening idempotently (resume=%s)', async(resume) => {
  const profile = await import('../profile')
  profile.initRecommendProfile()
  await vi.advanceTimersByTimeAsync(0)
  actions.setPlayMusicInfo('owned', song('a'))
  hub.musicToggled()
  actions.setMaxplayTime(20); hub.playerLoadeddata()
  actions.setIsPlay(true); hub.play()
  await vi.advanceTimersByTimeAsync(14000)
  actions.setIsPlay(false); hub.error(); hub.playerError()
  await vi.advanceTimersByTimeAsync(5000)
  if (resume) {
    actions.setIsPlay(true); hub.play()
    await vi.advanceTimersByTimeAsync(1000)
    actions.setIsPlay(false); hub.playerError(); hub.error()
    await vi.advanceTimersByTimeAsync(5000)
  }
  actions.setPlayMusicInfo('owned', song('b')); hub.musicToggled()
  expect(profile.getProfileState()?.completes).toBe(0)
})
