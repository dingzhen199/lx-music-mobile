import { describe, expect, it, vi } from 'vitest'
import { writebackToggleMusicInfo, type ToggleWritebackEnvironment } from './toggleWriteback'
const song = (id: string, source: 'wy' | 'tx' = 'wy') => ({ id, source, name: 'Song', singer: 'Artist', interval: null, meta: { albumName: '', qualitys: [], _qualitys: {}, songId: id } }) as LX.Music.MusicInfoOnline
const setup = () => {
  const original = song('old')
  const resolved = song('new', 'tx')
  const context = { listId: 'owned' as string | null, isTempPlay: false, musicInfo: original }
  const list = [song('first'), original, song('last')]
  const order: string[] = []
  const env: ToggleWritebackEnvironment = {
    getContext: () => context,
    isUserList: id => id === 'owned',
    getList: () => list,
    add: vi.fn(async() => { order.push('add') }),
    move: vi.fn(async() => { order.push('move') }),
    replaceCurrent: vi.fn(() => { order.push('replace') }),
    remove: vi.fn(async() => { order.push('remove') }),
  }
  return { original, resolved, context, list, env, order }
}
describe('provider writeback', () => {
  it('inserts, positions and migrates playback before deleting the original', async() => {
    const { original, resolved, env, order } = setup()
    await expect(writebackToggleMusicInfo(original, resolved, env)).resolves.toBe(true)
    expect(order).toEqual(['add', 'move', 'replace', 'remove'])
    expect(env.move).toHaveBeenCalledWith('owned', 'new', 1)
    expect(original.meta.toggleMusicInfo).toBe(resolved)
  })
  it('adjusts position when the resolved item already precedes the original', async() => {
    const { original, resolved, list, env } = setup()
    list[0] = resolved
    await writebackToggleMusicInfo(original, resolved, env)
    expect(env.move).toHaveBeenCalledWith('owned', 'new', 0)
  })
  it.each(['sameProvider', 'temporary', 'external', 'changedTrack', 'missingTrack'])('does not write back %s', async(reason) => {
    const { original, resolved, context, list, env } = setup()
    if (reason === 'sameProvider') resolved.source = original.source
    if (reason === 'temporary') context.isTempPlay = true
    if (reason === 'external') context.listId = 'search'
    if (reason === 'changedTrack') context.musicInfo = song('next')
    if (reason === 'missingTrack') list.splice(1, 1)
    await expect(writebackToggleMusicInfo(original, resolved, env)).resolves.toBe(false)
    expect(env.add).not.toHaveBeenCalled()
  })
  it('does not migrate or remove the old track after a concurrent track change', async() => {
    const { original, resolved, context, env } = setup()
    env.add = vi.fn(async() => { context.musicInfo = song('next') })
    await expect(writebackToggleMusicInfo(original, resolved, env)).resolves.toBe(false)
    expect(env.replaceCurrent).not.toHaveBeenCalled()
    expect(env.remove).not.toHaveBeenCalled()
  })
})
