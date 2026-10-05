import { createMusicuFetch, filterMusicInfoItem } from './singer'

export default {
  async getAlbumDetail(id, page = 1, limit = 50) {
    // Existing search/playlist metadata stores MID; singer metadata stores numeric ID.
    const identity = String(id).trim()
    if (!/^[a-zA-Z0-9]+$/.test(identity)) throw new Error('Invalid QQ album identity')
    const numeric = /^\d+$/.test(identity)
    if (numeric && (!Number.isSafeInteger(Number(identity)) || Number(identity) < 1)) throw new Error('Invalid QQ album ID')
    const album = numeric ? { albumID: Number(identity) } : { albumMid: identity }
    const body = await createMusicuFetch({
      req: {
        module: 'music.musichallAlbum.AlbumSongList',
        method: 'GetAlbumSongList',
        param: { ...album, begin: (page - 1) * limit, num: limit },
      },
    })
    const data = body.req?.data
    if (body.req?.code !== 0 || !Array.isArray(data?.songList)) throw new Error('Get album songs failed')
    return {
      list: data.songList.map(item => filterMusicInfoItem(item.songInfo)),
      total: data.totalNum,
      page,
      limit,
      source: 'tx',
    }
  },
}
