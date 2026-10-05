import { type ReactElement } from 'react'
import { Modal, FlatList, Alert, View } from 'react-native'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { StateEvent } from '@/event/stateEvent'
import state from '@/store/player/state'
import QueueButton from './QueueButton'
import CatalogLinks from './CatalogLinks'
const mocks = vi.hoisted(() => ({ next: vi.fn(), resolve: vi.fn(), load: vi.fn(), play: vi.fn(), playNow: vi.fn(), addQueue: vi.fn(), queuePlay: vi.fn(), queueMove: vi.fn(), queueRemove: vi.fn(), queueNext: vi.fn(), clear: vi.fn(), alert: vi.fn() }))
vi.mock('@/lang', () => ({ useI18n: () => (key: string) => ({ playback_queue: '当前播放队列', catalog_artist_action: '查看艺人全部歌曲', catalog_album_action: '查看专辑全部歌曲' }[key] ?? key) }))
vi.mock('react-native', () => ({ View: 'View', Modal: 'Modal', Pressable: 'button', ScrollView: 'ScrollView', FlatList: 'FlatList', Alert: { alert: mocks.alert } }))
vi.mock('@/components/common/Text', () => ({ default: 'span' }))
vi.mock('@/store/theme/hook', () => ({ useTheme: () => ({ 'c-content-background': '#fff' }) }))
vi.mock('@/store/player/hook', () => ({ usePlayerMusicInfo: () => ({ name: 'song', singer: 'artist', album: 'album' }) }))
vi.mock('@/core/player/playInfo', () => ({ getList: () => [] }))
vi.mock('@/core/player/tempPlayList', () => ({ addTempPlayList: mocks.addQueue }))
vi.mock('@/core/player/player', () => ({ getNextPlayMusicInfo: mocks.next, playSelectedList: mocks.play, playMusicInfoNow: mocks.playNow, playQueueItem: mocks.queuePlay, moveQueueItem: mocks.queueMove, removeQueueItem: mocks.queueRemove, queueItemNext: mocks.queueNext, clearPlaybackQueue: mocks.clear }))
vi.mock('@/core/catalog/sdk', () => ({ catalogAdapter: { resolve: mocks.resolve, load: mocks.load } }))
const song = (id: string): LX.Music.MusicInfoOnline => ({ id, source: 'wy', name: id, singer: 'artist', interval: null, meta: { albumName: 'album', songId: id, qualitys: [], _qualitys: {} } })
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
  await act(async() => { tree.root.findByType(Modal).props.onRequestClose() })
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
  await act(async() => { tree.root.findByType(Modal).props.onRequestClose() })
  await act(async() => { finish({ list: [song('late')], page: 1, limit: 50, total: 1, hasMore: false }) })
  expect(tree.root.findByType(Modal).props.visible).toBe(false)
  expect(tree.root.findByType(FlatList).props.data).toEqual([])
})
it('unsupported album displays a recoverable error instead of fuzzy search results', async() => {
  mocks.resolve.mockRejectedValue(new Error('unsupported'))
  await act(async() => { tree = create(<CatalogLinks />) })
  await act(async() => { tree.root.findByProps({ accessibilityLabel: '查看专辑全部歌曲' }).props.onPress() })
  expect(JSON.stringify(tree.toJSON())).toContain('目录加载失败')
  expect(mocks.load).not.toHaveBeenCalled()
})

it('catalog song actions stay within the same native modal and Back closes them first', async() => {
  mocks.resolve.mockResolvedValue([{ kind: 'artist', source: 'wy', id: 1, name: 'artist' }])
  mocks.load.mockResolvedValue({ list: [song('track')], page: 1, limit: 50, total: 1, hasMore: false })
  await act(async() => { tree = create(<CatalogLinks />) })
  await act(async() => { tree.root.findByProps({ accessibilityLabel: '查看艺人全部歌曲' }).props.onPress() })
  const row = tree.root.findByType(FlatList).props.renderItem({ item: song('track'), index: 0 }) as ReactElement
  let rowTree!: ReactTestRenderer
  await act(async() => { rowTree = create(row) })
  await act(async() => { rowTree.root.findByProps({ accessibilityLabel: 'catalog_song_actions track' }).props.onPress() })
  expect(tree.root.findAllByType(Modal)).toHaveLength(1)
  expect(tree.root.findByProps({ accessibilityViewIsModal: true }).parent?.type).toBe(View)
  expect(JSON.stringify(tree.toJSON())).toContain('playback_play_next')
  await act(async() => { tree.root.findByType(Modal).props.onRequestClose() })
  expect(tree.root.findByType(Modal).props.visible).toBe(true)
  expect(tree.root.findAllByProps({ accessibilityViewIsModal: true })).toHaveLength(0)
  await act(async() => { rowTree.root.findByProps({ accessibilityLabel: 'catalog_song_actions track' }).props.onPress() })
  const action = tree.root.findAllByType('button').find(button => button.findAllByType('span').some(text => text.props.children === 'playback_play_next'))!
  await act(async() => { action.props.onPress() })
  expect(mocks.addQueue).toHaveBeenCalledWith([{ musicInfo: song('track'), listId: null, isTop: true }])
  expect(tree.root.findAllByProps({ accessibilityViewIsModal: true })).toHaveLength(0)
  await act(async() => { rowTree.unmount() })
})
it('queue clear requires confirmation and cancel leaves playback untouched', async() => {
  await act(async() => { tree = create(<QueueButton />) })
  await act(async() => { tree.root.findByProps({ accessibilityLabel: '当前播放队列' }).props.onPress() })
  const clear = tree.root.findAllByType('button').find(button => button.findAllByType('span').some(text => text.props.children === 'playback_clear'))!
  await act(async() => { clear.props.onPress() })
  expect(mocks.clear).not.toHaveBeenCalled()
  const buttons = vi.mocked(Alert.alert).mock.calls[0][2]!
  expect(buttons[0].style).toBe('cancel')
  await act(async() => { buttons[1].onPress!() })
  expect(mocks.clear).toHaveBeenCalledOnce()
})
