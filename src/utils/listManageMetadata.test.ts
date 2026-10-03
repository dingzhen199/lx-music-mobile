import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('@/utils/data', () => ({ getUserLists: vi.fn(), getListMusics: vi.fn(), overwriteListPosition: vi.fn(), overwriteListUpdateInfo: vi.fn(), removeListPosition: vi.fn(), removeListUpdateInfo: vi.fn() }))
import { setUserLists, userLists, userListCreate, userListsUpdate } from './listManage'
beforeEach(() => { setUserLists([]) })
it('preserves cover, description and author through list creation and ordinary rename', () => {
  userListCreate({ id: 'wy_1', name: 'one', source: 'wy', sourceListId: '1', position: 0, locationUpdateTime: null, cover: 'cover', desc: 'description', author: 'author' })
  expect(userLists[0]).toMatchObject({ cover: 'cover', desc: 'description', author: 'author', sourceListId: '1' })
  userListsUpdate([{ ...userLists[0], name: 'renamed', cover: undefined, desc: null, author: undefined }])
  expect(userLists[0]).toMatchObject({ name: 'renamed', cover: 'cover', desc: 'description', author: 'author' })
})
