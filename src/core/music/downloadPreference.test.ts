import { expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ exists: vi.fn(), online: vi.fn() }))
vi.mock('@/utils/fs', () => ({ existsFile: mocks.exists }))
vi.mock('./online', () => ({ getMusicUrl: mocks.online }))
vi.mock('./utils', () => ({}))
import { getMusicUrl } from './download'
it('completed downloaded version is playable offline even with a manual preference', async() => {
  const record = { isComplate: true, metadata: { filePath: '/music/version-b.mp3', musicInfo: { id: 'a', meta: { toggleMusicInfo: { id: 'b' }, manualVersionPinned: true } } } } as LX.Download.ListItem
  mocks.exists.mockResolvedValue(true)
  await expect(getMusicUrl({ musicInfo: record, isRefresh: false })).resolves.toBe('/music/version-b.mp3')
  expect(mocks.online).not.toHaveBeenCalled()
})
it('missing download falls back through preferred online version with resolution callback', async() => {
  const preferred = { id: 'b' }
  const record = { isComplate: true, metadata: { filePath: '/missing.mp3', musicInfo: { id: 'a', meta: { toggleMusicInfo: preferred } } } } as LX.Download.ListItem
  mocks.exists.mockResolvedValue(false); mocks.online.mockResolvedValue('url')
  const onResolvedMusicInfo = vi.fn()
  await getMusicUrl({ musicInfo: record, isRefresh: false, onResolvedMusicInfo })
  expect(mocks.online).toHaveBeenCalledWith(expect.objectContaining({ musicInfo: preferred, onResolvedMusicInfo }))
})
