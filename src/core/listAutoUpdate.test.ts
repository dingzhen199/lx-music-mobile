import { expect, it, vi } from 'vitest'
vi.mock('@/utils/data', () => ({ getListUpdateInfo: vi.fn() }))
vi.mock('@/store/list/state', () => ({ default: { userList: [] } }))
vi.mock('./syncSourceList', () => ({ default: vi.fn() }))
import { selectAutoUpdateLists } from './listAutoUpdate'
it('updates online lists by default while preserving explicit opt-outs', () => {
  const online = (id: string) => ({ id, name: id, source: 'wy' as const, sourceListId: '1', locationUpdateTime: null })
  const lists = [online('default'), online('off'), online('failed'), { id: 'local', name: 'Local', locationUpdateTime: null }]
  expect(selectAutoUpdateLists(lists, {
    off: { updateTime: 0, isAutoUpdate: false },
    failed: { updateTime: 0, isAutoUpdate: true, updateError: 'offline' },
  }).map(list => list.id)).toEqual(['default', 'failed'])
})
