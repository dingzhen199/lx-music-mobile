import state from '@/store/player/state'
/** Accept native evidence only for the resource installed for this exact selection epoch. */
export const readCurrentPlayback = async<T>(read: () => Promise<T>, nativeTrackId: () => Promise<string | null>, generation = state.playbackGeneration): Promise<T | null> => {
  const expected = state.resourceTrackId
  const current = () => generation === state.playbackGeneration && expected != null && expected === state.resourceTrackId
  if (!current() || await nativeTrackId() !== expected || !current()) return null
  const value = await read()
  if (!current() || await nativeTrackId() !== expected || !current()) return null
  return value
}
