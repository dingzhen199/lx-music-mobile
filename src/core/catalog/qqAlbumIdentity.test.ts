import { expect, it, vi } from 'vitest'
import songList from '@/utils/musicSdk/tx/songList'
import musicInfo from '@/utils/musicSdk/tx/musicInfo'
import search from '@/utils/musicSdk/tx/musicSearch'
import album from '@/utils/musicSdk/tx/album'
import { toNewMusicInfo } from '@/utils/musicInfo'
import { createCatalogAdapter } from '@/core/catalog/adapter'
const mocks = vi.hoisted(() => ({ http: vi.fn() }))
vi.mock('@/utils/request', () => ({ httpFetch: mocks.http }))
vi.mock('@/utils/musicSdk/tx/utils', () => ({ signRequest: vi.fn() }))
vi.mock('@/utils', async() => ({ ...(await import('@/utils/musicInfo')), formatPlayTime: String, sizeFormate: String, decodeName: String, dateFormat: String, formatPlayCount: String }))
vi.mock('@/utils/index', async() => ({ ...(await import('@/utils/musicInfo')), formatPlayTime: String, sizeFormate: String, decodeName: String, dateFormat: String, formatPlayCount: String }))
it.each(['search', 'playlist', 'detail', 'saved'] as const)('QQ %s album MID survives conversion and reaches the supported MID transport', async(producer) => {
  const raw = { id: 1, mid: 'track', title: 'Track', singer: [{ mid: 'singer', name: 'Singer' }], album: { id: 8220, mid: '000f01724fd7TH', name: 'Album' }, interval: 120, file: { media_mid: 'media', size_128mp3: 0, size_320mp3: 0, size_flac: 0, size_hires: 0 } }
  mocks.http.mockReturnValueOnce({ promise: Promise.resolve({ body: { code: 0, req: { code: 0, data: { track_info: raw } } } }) })
  const converted = producer === 'playlist' ? songList.filterListDetail([raw])[0] : producer === 'detail' ? await musicInfo('track') : search.handleResult([raw])[0]
  const normalized = toNewMusicInfo(converted) as LX.Music.MusicInfoOnline
  const music = producer === 'saved' ? JSON.parse(JSON.stringify(normalized)) as typeof normalized : normalized
  mocks.http.mockReset()
  expect(music.meta.albumId).toBe('000f01724fd7TH')
  mocks.http.mockReturnValue({ promise: Promise.resolve({ statusCode: 200, body: { code: 0, req: { code: 0, data: { songList: [], totalNum: 0 } } } }) })
  const adapter = createCatalogAdapter({ tx: { album: (id, page, limit) => album.getAlbumDetail(id, page, limit) } })
  const [target] = await adapter.resolve('album', music)
  await adapter.load(target)
  const payload = mocks.http.mock.lastCall![1].body
  expect(payload.req.param).toEqual({ albumMid: '000f01724fd7TH', begin: 0, num: 50 })
  expect(JSON.stringify(payload)).not.toContain('null')
})
vi.mock('@/utils/musicSdk/utils', () => ({ formatSingerName: (artists: any[]) => artists.map(a => a.name).join(' / ') }))
