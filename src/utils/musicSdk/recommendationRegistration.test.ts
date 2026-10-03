import { expect, it, vi } from 'vitest'
vi.mock('./api-source', () => ({ apis: vi.fn() }))
vi.mock('./tx/leaderboard', () => ({ default: {} }))
vi.mock('./tx/lyric', () => ({ default: {} }))
vi.mock('./tx/songList', () => ({ default: {} }))
vi.mock('./tx/musicSearch', () => ({ default: {} }))
vi.mock('./tx/hotSearch', () => ({ default: {} }))
vi.mock('./tx/comment', () => ({ default: {} }))
vi.mock('./wy/leaderboard', () => ({ default: {} }))
vi.mock('./wy/lyric', () => ({ default: {} }))
vi.mock('./wy/songList', () => ({ default: {} }))
vi.mock('./wy/musicSearch', () => ({ default: {} }))
vi.mock('./wy/hotSearch', () => ({ default: {} }))
vi.mock('./wy/comment', () => ({ default: {} }))
vi.mock('./wy/musicInfo', () => ({ default: {} }))
vi.mock('./tx/simiSong', () => ({ default: { getSimiSong: vi.fn() } }))
vi.mock('./wy/simiSong', () => ({ default: { getSimiSong: vi.fn() } }))
import tx from './tx'
import wy from './wy'
import txSimilar from './tx/simiSong'
import wySimilar from './wy/simiSong'
it('real provider entrypoints expose the registered single-song similarity adapters', () => {
  expect(tx.simiSong).toBe(txSimilar)
  expect(wy.simiSong).toBe(wySimilar)
  expect(tx.simiSong.getSimiSong).toBeTypeOf('function')
  expect(wy.simiSong.getSimiSong).toBeTypeOf('function')
})
