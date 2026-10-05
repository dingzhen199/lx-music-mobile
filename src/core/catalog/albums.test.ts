import { beforeEach, describe, expect, it, vi } from 'vitest'
import wyAlbum from '@/utils/musicSdk/wy/album'
import txAlbum from '@/utils/musicSdk/tx/album'
const mocks = vi.hoisted(() => ({ httpFetch: vi.fn(), eapiRequest: vi.fn() }))
vi.mock('@/utils/request', () => ({ httpFetch: mocks.httpFetch }))
vi.mock('@/utils/index', () => ({ formatPlayTime: (seconds: number) => String(seconds), sizeFormate: () => '1M', decodeName: (name: string) => name }))
vi.mock('@/utils/musicSdk/wy/utils/index', () => ({ eapiRequest: mocks.eapiRequest }))
vi.mock('react-native-quick-md5', () => ({ stringMd5: String }))
beforeEach(() => { vi.clearAllMocks() })
describe('album adapters use provider IDs and real transport contracts', () => {
  it('NetEase slices a complete album response without repeatedly appending page one', async() => {
    const songs = [1, 2, 3].map(id => ({ id, name: `${id}`, ar: [{ id: 7, name: 'Artist' }], al: { id: 8, name: 'Album' }, dt: 120000 }))
    mocks.eapiRequest.mockReturnValue({ promise: Promise.resolve({ body: { code: 200, songs } }) })
    expect(await wyAlbum.getAlbumDetail(8, 2, 2)).toMatchObject({ total: 3, limit: 2, page: 2, list: [{ songmid: 3 }] })
    expect(mocks.eapiRequest).toHaveBeenCalledWith('/api/v1/album/8', {})
    expect(await wyAlbum.getAlbumDetail(8, 3, 2)).toMatchObject({ list: [], total: 3 })
  })
  it('NetEase distinguishes an empty album from malformed/failed responses', async() => {
    mocks.eapiRequest.mockReturnValueOnce({ promise: Promise.resolve({ body: { code: 200, songs: [] } }) })
    expect(await wyAlbum.getAlbumDetail(8)).toMatchObject({ list: [], total: 0 })
    mocks.eapiRequest.mockReturnValueOnce({ promise: Promise.resolve({ body: { code: 500 } }) })
    await expect(wyAlbum.getAlbumDetail(8)).rejects.toThrow()
  })
  it('QQ uses numeric album IDs and one-based contiguous offsets', async() => {
    const songInfo = { id: 1, mid: 'song', title: 'Song', singer: [{ mid: 'artist', name: 'Artist' }], album: { id: 8, mid: 'album', name: 'Album' }, interval: 120, file: { media_mid: 'media', size_128mp3: 0, size_320mp3: 0, size_flac: 0, size_hires: 0 } }
    mocks.httpFetch.mockReturnValue({ promise: Promise.resolve({ statusCode: 200, body: { code: 0, req: { code: 0, data: { totalNum: 3, songList: [{ songInfo }] } } } }) })
    expect(await txAlbum.getAlbumDetail(8, 2, 2)).toMatchObject({ total: 3, limit: 2, page: 2, list: [{ songmid: 'song', albumId: 8 }] })
    expect(mocks.httpFetch.mock.lastCall![1].body.req).toEqual({ module: 'music.musichallAlbum.AlbumSongList', method: 'GetAlbumSongList', param: { albumID: 8, begin: 2, num: 2 } })
  })
  it('QQ rejects malformed rows instead of silently showing an empty catalog', async() => {
    mocks.httpFetch.mockReturnValue({ promise: Promise.resolve({ statusCode: 200, body: { code: 0, req: { code: 0, data: {} } } }) })
    await expect(txAlbum.getAlbumDetail(8)).rejects.toThrow()
  })
})

it.each(['8220', 8220])('QQ retains numeric album-ID compatibility for %s', async(id) => {
  mocks.httpFetch.mockReturnValue({ promise: Promise.resolve({ statusCode: 200, body: { code: 0, req: { code: 0, data: { totalNum: 0, songList: [] } } } }) })
  await txAlbum.getAlbumDetail(id)
  expect(mocks.httpFetch.mock.lastCall![1].body.req.param).toEqual({ albumID: 8220, begin: 0, num: 50 })
})
it.each(['', 'bad/id', '0', '999999999999999999999'])('QQ rejects malformed album identity %s before requesting', async(id) => {
  await expect(txAlbum.getAlbumDetail(id)).rejects.toThrow()
  expect(mocks.httpFetch).not.toHaveBeenCalled()
})
