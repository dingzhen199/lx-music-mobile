import txAlbum from '@/utils/musicSdk/tx/album'
import wyAlbum from '@/utils/musicSdk/wy/album'
import kgSinger from '@/utils/musicSdk/kg/singer'
import txSinger from '@/utils/musicSdk/tx/singer'
import wySinger from '@/utils/musicSdk/wy/singer'
import kwAlbum from '@/utils/musicSdk/kw/album'
import kgAlbum from '@/utils/musicSdk/kg/album'
import mgAlbum from '@/utils/musicSdk/mg/album'
import getTxMusicInfo from '@/utils/musicSdk/tx/musicInfo'
import getWyMusicInfo from '@/utils/musicSdk/wy/musicInfo'
import { getMusicInfo as getKgMusicInfo } from '@/utils/musicSdk/kg/musicInfo'
import { createCatalogAdapter } from './adapter'

export const catalogAdapter = createCatalogAdapter({
  tx: {
    album: async(id, page, limit) => txAlbum.getAlbumDetail(id, page, limit),
    artist: async(id, page, limit) => txSinger.getSongList(id, page, limit),
    detail: async(music) => getTxMusicInfo(music.meta.songId),
  },
  wy: {
    album: async(id, page, limit) => wyAlbum.getAlbumDetail(id, page, limit),
    artist: async(id, page, limit) => wySinger.getSongList(id, page, limit),
    detail: async(music) => {
      // The legacy JS request gains promise dynamically, which its inferred type omits.
      const request = getWyMusicInfo(music.meta.songId) as ReturnType<typeof getWyMusicInfo> & {
        promise: Promise<{ ar?: LX.Music.CatalogArtist[], al?: { id: number, name: string } }>
      }
      const raw = await request.promise
      return {
        artists: raw.ar?.map(artist => ({ id: artist.id, name: artist.name })),
        albumId: raw.al?.id,
        albumName: raw.al?.name,
      }
    },
  },
  kg: {
    artist: async(id, page, limit) => kgSinger.getSingerSongList(id, page, limit),
    album: async(id, page, limit) => kgAlbum.getAlbumDetail(id, page, limit),
    detail: async(music) => music.source === 'kg' ? getKgMusicInfo(music.meta.hash) : null,
  },
  kw: { album: (id, page) => kwAlbum.getAlbumListDetail(id, page) },
  mg: { album: async(id, page) => mgAlbum.getAlbumDetail(id, page), albumPageSize: 'response-length' },
})
