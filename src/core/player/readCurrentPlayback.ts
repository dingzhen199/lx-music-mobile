import state from '@/store/player/state'
/** Metadata must belong to this playback generation, even when the same song is replayed. */
export const readCurrentPlayback = async<T>(read: () => Promise<T>): Promise<T | null> => {
  const generation = state.playbackGeneration
  const value = await read()
  return generation === state.playbackGeneration ? value : null
}
