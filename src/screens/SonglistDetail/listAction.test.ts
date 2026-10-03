import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ lists: [] as any[], info: { name: 'Original', img: 'cover', desc: 'description', author: 'author' }, create: vi.fn(), fetch: vi.fn(), confirm: vi.fn(), sync: vi.fn() }))
vi.mock('@/core/list', () => ({ createList: m.create, setTempList: vi.fn() }))
vi.mock('@/core/player/player', () => ({ playList: vi.fn() }))
vi.mock('@/core/songlist', () => ({ getListDetail: vi.fn(), getListDetailAll: m.fetch }))
vi.mock('@/store/list/state', () => ({ default: { userList: m.lists } }))
vi.mock('@/store/songlist/state', () => ({ default: { listDetailInfo: { info: m.info } } }))
vi.mock('@/core/syncSourceList', () => ({ default: m.sync }))
vi.mock('@/utils/tools', () => ({ confirmDialog: m.confirm, toMD5: (s: string) => s, toast: vi.fn() }))
import { handleCollect } from './listAction'
beforeEach(() => {
  vi.clearAllMocks(); m.lists.length = 0
  Object.assign(m.info, { name: 'Original', img: 'cover', desc: 'description', author: 'author' })
  m.fetch.mockResolvedValue([]); m.confirm.mockResolvedValue(true); m.sync.mockResolvedValue(undefined)
  vi.stubGlobal('i18n', { t: (key: string) => key })
})
it('detects a duplicate using raw source playlist ID and provider', async() => {
  m.lists.push({ id: 'local', name: 'Saved', source: 'wy', sourceListId: '123' })
  await handleCollect('123', 'wy', 'Original')
  expect(m.sync).toHaveBeenCalledWith(m.lists[0])
  expect(m.create).not.toHaveBeenCalled()
})
it('snapshots source metadata before an async fetch can change the detail page', async() => {
  let finish!: (value: any[]) => void
  m.fetch.mockReturnValue(new Promise<any[]>(resolve => { finish = resolve }))
  const task = handleCollect('123', 'wy', 'Original')
  Object.assign(m.info, { img: 'wrong', desc: 'wrong', author: 'wrong' })
  finish([])
  await task
  expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ sourceListId: '123', source: 'wy', cover: 'cover', desc: 'description', author: 'author' }))
})
