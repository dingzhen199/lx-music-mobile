// import { dateFormat } from '@/utils/common'
import { setListUpdateTime, setListUpdateError } from '@/utils/data'
import { overwriteListMusics, setFetchingListStatus } from './list'
import { getListDetailAll } from '@/core/songlist'
import { getListDetailAll as getBoardListAll } from '@/core/leaderboard'

const fetchList = async(id: string, source: LX.OnlineSource, sourceListId: string) => {
  let promise
  if (/^board__/.test(sourceListId)) {
    const id = sourceListId.replace(/^board__/, '')
    promise = id ? getBoardListAll(id, true) : Promise.reject(new Error('id not defined: ' + sourceListId))
  } else {
    promise = getListDetailAll(source, sourceListId, true)
  }
  return promise
}

export default async(targetListInfo: LX.List.UserListInfo) => {
  // console.log(targetListInfo)
  if (!targetListInfo.source || !targetListInfo.sourceListId) return
  setFetchingListStatus(targetListInfo.id, true)
  try {
    const list = await fetchList(targetListInfo.id, targetListInfo.source, targetListInfo.sourceListId)
    await overwriteListMusics(targetListInfo.id, list)
    await setListUpdateTime(targetListInfo.id, Date.now())
    await setListUpdateError(targetListInfo.id, null)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await setListUpdateError(targetListInfo.id, message).catch(() => {})
    throw error
  } finally {
    setFetchingListStatus(targetListInfo.id, false)
  }
}
