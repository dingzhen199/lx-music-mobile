import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { StateEvent } from '@/event/stateEvent'
const mocks = vi.hoisted(() => ({ next: vi.fn(), resolve: vi.fn(), load: vi.fn(), play: vi.fn() }))
vi.mock('@/lang', () => ({ useI18n: () => (key: string) => ({ playback_queue: '当前播放队列', catalog_artist_action: '查看艺人全部歌曲', catalog_album_action: '查看专辑全部歌曲' }[key] ?? key) }))
vi.mock('react-native', () => ({ View: 'View', Modal: 'Modal', Pressable: 'button', ScrollView: 'ScrollView' }))
vi.mock('@/components/common/Text', () => ({ default: 'span' }))
vi.mock('@/store/theme/hook', () => ({ useTheme: () => ({ 'c-content-background': '#fff' }) }))
vi.mock('@/store/player/hook', () => ({ usePlayerMusicInfo: () => ({ name: 'song', singer: 'artist', album: 'album' }) }))
vi.mock('@/utils/listManage', () => ({ getListMusicSync: () => [] }))
vi.mock('@/core/player/player', () => ({ getNextPlayMusicInfo: mocks.next, playSelectedList: mocks.play }))
vi.mock('@/core/catalog/sdk', () => ({ catalogAdapter: { resolve: mocks.resolve, load: mocks.load } }))
import state from '@/store/player/state'
import QueueButton from './QueueButton'
import CatalogLinks from './CatalogLinks'
const song = (id: string) => ({ id, source: 'wy', name: id, singer: 'artist', interval: null, meta: { albumName: 'album' } }) as LX.Music.MusicInfoOnline
let tree: ReactTestRenderer
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('state_event', new StateEvent()); vi.stubGlobal('app_event', { on: vi.fn(), off: vi.fn() })
  state.playMusicInfo = { musicInfo: song('a'), listId: null, isTempPlay: true }
  state.tempPlayList = [{ musicInfo: song('b'), listId: null, isTempPlay: true }]
  mocks.next.mockResolvedValue(state.tempPlayList[0])
})
afterEach(async() => { if (tree) await act(async() => { tree.unmount() }); vi.unstubAllGlobals() })
it('queue opens beside player and ignores a late next-song response after closing', async() => {
  let finish!: (value: unknown) => void
  mocks.next.mockImplementationOnce(async() => new Promise(resolve => { finish = resolve }))
  await act(async() => { tree = create(<QueueButton />) })
  await act(async() => { tree.root.findByProps({ accessibilityLabel: '当前播放队列' }).props.onPress() })
  await act(async() => { tree.root.findByType('Modal' as any).props.onRequestClose() })
  await act(async() => { finish({ musicInfo: song('stale') }) })
  expect(JSON.stringify(tree.toJSON())).not.toContain('stale')
  await act(async() => { tree.root.findByProps({ accessibilityLabel: '当前播放队列' }).props.onPress() })
  expect(JSON.stringify(tree.toJSON())).toContain('b')
})
it('artist selection displays real catalog and close invalidates pending load', async() => {
  mocks.resolve.mockResolvedValue([{ kind: 'artist', source: 'wy', id: 1, name: 'artist' }])
  let finish!: (value: unknown) => void
  mocks.load.mockImplementationOnce(async() => new Promise(resolve => { finish = resolve }))
  await act(async() => { tree = create(<CatalogLinks />) })
  await act(async() => { tree.root.findByProps({ accessibilityLabel: '查看艺人全部歌曲' }).props.onPress() })
  await act(async() => { tree.root.findByType('Modal' as any).props.onRequestClose() })
  await act(async() => { finish({ list: [song('late')], page: 1, limit: 50, total: 1, hasMore: false }) })
  expect(tree.root.findByType('Modal' as any).props.visible).toBe(false)
  expect(JSON.stringify(tree.toJSON())).not.toContain('late')
})
it('unsupported album displays a recoverable error instead of fuzzy search results', async() => {
  mocks.resolve.mockRejectedValue(new Error('unsupported'))
  await act(async() => { tree = create(<CatalogLinks />) })
  await act(async() => { tree.root.findByProps({ accessibilityLabel: '查看专辑全部歌曲' }).props.onPress() })
  expect(JSON.stringify(tree.toJSON())).toContain('目录加载失败')
  expect(mocks.load).not.toHaveBeenCalled()
})
