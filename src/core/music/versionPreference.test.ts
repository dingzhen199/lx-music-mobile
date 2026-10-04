import { expect, it } from 'vitest'
import { selectManualVersion, getPreferredVersion } from './versionPreference'
const song = (id: string) => ({ id, source: 'wy', name: id, singer: 'artist', interval: null, meta: { songId: id, albumName: '', qualitys: [], _qualitys: {} } }) as LX.Music.MusicInfo_online_common
it('manual selection preserves collection identity and strips nested preferences', () => {
  const original = song('a')
  const selected = { ...song('b'), meta: { ...song('b').meta, toggleMusicInfo: song('c'), manualVersionPinned: true } }
  const pinned = selectManualVersion(original, selected)
  expect(pinned.id).toBe('a')
  expect(pinned.meta.manualVersionPinned).toBe(true)
  expect(getPreferredVersion(pinned).id).toBe('b')
  expect(getPreferredVersion(pinned).meta.toggleMusicInfo).toBeUndefined()
  expect(original.meta.toggleMusicInfo).toBeUndefined()
})
it('selecting original clears a legacy preference without changing identity', () => {
  const original = { ...song('a'), meta: { ...song('a').meta, toggleMusicInfo: song('b') } }
  expect(getPreferredVersion(original).id).toBe('b')
  expect(selectManualVersion(original, original)).toMatchObject({ id: 'a', meta: { toggleMusicInfo: null, manualVersionPinned: true } })
})
