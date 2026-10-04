/** A selected version is a preference; the collection entry remains its original identity. */
export const getPreferredVersion = <T extends LX.Music.MusicInfo>(musicInfo: T): T | LX.Music.MusicInfoOnline => musicInfo.meta.toggleMusicInfo ?? musicInfo

export const selectManualVersion = (original: LX.Music.MusicInfo, selected: LX.Music.MusicInfoOnline): LX.Music.MusicInfo => {
  const target = { ...selected }
  target.meta = { ...selected.meta }
  delete target.meta.toggleMusicInfo
  delete target.meta.manualVersionPinned
  const result = { ...original }
  result.meta = { ...original.meta, manualVersionPinned: true, toggleMusicInfo: original.id === selected.id ? null : target }
  return result
}
