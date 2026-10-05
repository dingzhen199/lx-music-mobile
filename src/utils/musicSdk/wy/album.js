import { eapiRequest } from './utils/index'
import singer from './singer'

export default {
  async getAlbumDetail(id, page = 1, limit = 50) {
    const { body } = await eapiRequest(`/api/v1/album/${encodeURIComponent(id)}`, {}).promise
    if (body?.code !== 200 || !Array.isArray(body.songs)) throw new Error('Get album songs failed')
    // This endpoint returns the complete album. Present the same one-based paging contract as other SDKs.
    return {
      list: singer.filterSongList(body.songs.slice((page - 1) * limit, page * limit)),
      total: body.songs.length,
      page,
      limit,
      source: 'wy',
    }
  },
}
