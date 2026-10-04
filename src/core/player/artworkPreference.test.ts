import { it, expect, vi } from 'vitest'
vi.mock('@/utils/data', () => ({ getUserLists: vi.fn(), getListMusics: vi.fn(), overwriteListPosition: vi.fn(), overwriteListUpdateInfo: vi.fn(), removeListPosition: vi.fn(), removeListUpdateInfo: vi.fn() }))
vi.mock('@/core/list', async() => {
 const { listMusicUpdateInfo } = await import('@/utils/listManage')
 return { updateListMusics: listMusicUpdateInfo }
})
vi.mock('@/store/setting/state', () => ({ default: { setting: {} } }))
const mocks = vi.hoisted(() => ({ pic: vi.fn(async({ musicInfo }: any) => ({ url: 'cover-url', musicInfo, isFromCache: false })) }))
vi.mock('@/core/music/utils', () => ({ handleGetOnlinePicUrl: mocks.pic }))
vi.mock('@/core/music/local', () => ({}))
vi.mock('@/core/music/download', () => ({}))
import { setMusicList, getListMusicSync, listMusicUpdateInfo } from '@/utils/listManage'
import { getPicPath } from '@/core/music'
import { selectManualVersion } from '@/core/music/versionPreference'
const song = (id:string) => ({ id, name:id, singer:'Artist', source:'wy', meta:{ albumName:'Album', picUrl:null } }) as LX.Music.MusicInfoOnline
it('loading A preferred B artwork must not clear independently collected B preference C', async() => {
 const a=song('a'), b=song('b'), c=song('c')
 const pinnedA=selectManualVersion(a,b), pinnedB=selectManualVersion(b,c)
 setMusicList('owned',[pinnedA,pinnedB])
 await getPicPath({musicInfo:pinnedA,listId:'owned'})
 expect(getListMusicSync('owned')[1].meta.toggleMusicInfo?.id).toBe('c')
})

it('late A cover response must preserve a newly saved A preference B', async() => {
 const a=song('a'), b=song('b')
 let finish!: (v:any)=>void
 mocks.pic.mockImplementationOnce(async()=>new Promise(resolve=>{finish=resolve}))
 setMusicList('owned',[a])
 const oldPic=getPicPath({musicInfo:a,listId:'owned'})
 await listMusicUpdateInfo([{id:'owned', musicInfo:selectManualVersion(a,b)}])
 finish({url:'old-cover', musicInfo:a,isFromCache:false})
 await oldPic
 expect(getListMusicSync('owned')[0].meta.toggleMusicInfo?.id).toBe('b')
})
