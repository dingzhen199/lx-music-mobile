import { getListUpdateInfo } from '@/utils/data'
import listState from '@/store/list/state'
import syncSourceList from './syncSourceList'

export const selectAutoUpdateLists = (lists: LX.List.UserListInfo[], updates: Partial<LX.List.ListUpdateInfo>) => {
  return lists.filter(list => !!list.source && !!list.sourceListId && updates[list.id]?.isAutoUpdate !== false)
}

/** Sequential startup updates avoid flooding providers; one failure does not stop later lists. */
export const autoUpdateOnlineLists = async() => {
  const updates = await getListUpdateInfo()
  for (const list of selectAutoUpdateLists([...listState.userList], updates)) {
    if (!listState.userList.some(current => current.id === list.id)) continue
    try { await syncSourceList(list) } catch {}
  }
}
