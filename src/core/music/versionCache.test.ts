import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn(), resolve: vi.fn() }))
vi.mock('@/core/list', () => ({ updateListMusics: vi.fn() }))
vi.mock('@/store/setting/state', () => ({ default: { setting: { 'player.playQuality': '128k' } } }))
vi.mock('@/utils/data', () => ({ getMusicUrlInfo: mocks.read, saveMusicUrl: mocks.save, saveLyric: vi.fn() }))
vi.mock('./utils', () => ({ getPlayQuality: () => '128k', handleGetOnlineMusicUrl: mocks.resolve }))
vi.mock('./local', () => ({ getMusicUrl: vi.fn() }))
vi.mock('./download', () => ({ getMusicUrl: vi.fn() }))
import { getMusicUrl } from './index'
const song = (id: string) => ({ id, source: 'wy', name: id, singer: 'artist', interval: null, meta: { songId: id, albumName: '', qualitys: [], _qualitys: {} } }) as LX.Music.MusicInfo_online_common
beforeEach(() => { vi.clearAllMocks(); mocks.save.mockResolvedValue(undefined) })
it('play and preload repeatedly try preferred version, rejecting old fallback alias cache', async() => {
  const preferred = song('preferred')
  const fallback = song('fallback')
  const original = { ...song('original'), meta: { ...song('original').meta, toggleMusicInfo: preferred, manualVersionPinned: true } }
  mocks.read.mockResolvedValue({ url: 'old-fallback', musicInfo: fallback })
  mocks.resolve.mockResolvedValue({ url: 'new-fallback', quality: '128k', musicInfo: fallback, isFromCache: false })
  const resolved = vi.fn()
  await getMusicUrl({ musicInfo: original }) // preload
  await getMusicUrl({ musicInfo: original, onResolvedMusicInfo: resolved }) // playback
  expect(mocks.resolve).toHaveBeenCalledTimes(2)
  expect(mocks.resolve.mock.calls.every(([args]) => args.musicInfo.id === preferred.id)).toBe(true)
  expect(mocks.save.mock.calls.every(([actual]) => actual.id === fallback.id)).toBe(true)
  expect(resolved).toHaveBeenCalledWith(fallback)
  expect(original.meta.toggleMusicInfo).toBe(preferred)
})
it('exact preferred cached resource can be reused', async() => {
  const preferred = song('preferred')
  mocks.read.mockResolvedValue({ url: 'preferred-cache', musicInfo: preferred })
  await expect(getMusicUrl({ musicInfo: preferred })).resolves.toBe('preferred-cache')
  expect(mocks.resolve).not.toHaveBeenCalled()
})
