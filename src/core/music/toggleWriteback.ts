import { isProviderChanged } from './sourceRotation'

export interface ToggleWritebackEnvironment {
  getContext: () => { listId: string | null, isTempPlay: boolean, musicInfo: LX.Music.MusicInfo | LX.Download.ListItem | null }
  isUserList: (listId: string) => boolean
  getList: (listId: string) => LX.Music.MusicInfo[] | undefined
  add: (listId: string, info: LX.Music.MusicInfoOnline) => Promise<void>
  move: (listId: string, id: string, position: number) => Promise<void>
  replaceCurrent: (listId: string, original: LX.Music.MusicInfoOnline, resolved: LX.Music.MusicInfoOnline) => void
  remove: (listId: string, id: string) => Promise<void>
}

/** Commit a resolved provider only in an owned list, preserving playback identity and order. */
export const writebackToggleMusicInfo = async(
  original: LX.Music.MusicInfoOnline,
  resolved: LX.Music.MusicInfoOnline,
  env: ToggleWritebackEnvironment,
): Promise<boolean> => {
  if (!isProviderChanged(original.source, resolved.source)) return false
  const context = env.getContext()
  const listId = context.listId
  if (!listId || context.isTempPlay || !env.isUserList(listId) || context.musicInfo !== original) return false
  const list = env.getList(listId)
  if (!list) return false
  let position = list.findIndex(item => item.id === original.id)
  if (position < 0) return false
  const existingIndex = list.findIndex(item => item.id === resolved.id)
  const stillCurrent = () => {
    const current = env.getContext()
    return current.listId === listId && !current.isTempPlay && current.musicInfo === original
  }
  // Insert before removal: every list event can still find the playing track.
  await env.add(listId, resolved)
  if (!stillCurrent()) return false
  if (existingIndex >= 0 && existingIndex < position) position--
  await env.move(listId, resolved.id, position)
  if (!stillCurrent()) return false
  original.meta.toggleMusicInfo = resolved
  env.replaceCurrent(listId, original, resolved)
  await env.remove(listId, original.id)
  return true
}
