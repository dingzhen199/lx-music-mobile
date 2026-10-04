import { FlatList } from 'react-native'
import Text from '@/components/common/Text'
import { createRef, type ReactElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { expect, it, vi } from 'vitest'
import playerState from '@/store/player/state'
import MusicToggleModal, { type MusicToggleModalType } from './MusicToggleModal'
const mocks = vi.hoisted(() => ({ add: vi.fn(), confirm: vi.fn(async() => true) }))
vi.mock('react-native', () => ({ View: 'View', ScrollView: 'ScrollView', TouchableOpacity: 'button', FlatList: 'FlatList' }))
vi.mock('@/components/common/Text', () => ({ default: 'Text' }))
vi.mock('@/components/common/Button', () => ({ default: 'button' }))
vi.mock('@/components/common/Icon', () => ({ Icon: 'Icon' }))
vi.mock('@/components/common/Dialog', async() => {
  const React = await import('react')
  return { default: React.forwardRef((props: any, ref) => { React.useImperativeHandle(ref, () => ({ setVisible: vi.fn() })); return <>{props.children}</> }) }
})
vi.mock('@/utils/tools', () => ({ createStyle: (s: unknown) => s }))
vi.mock('@/utils/pixelRatio', () => ({ scaleSizeH: (n: number) => n }))
vi.mock('@/store/theme/hook', () => ({ useTheme: () => ({}) }))
vi.mock('@/utils/hooks', async() => ({ useHorizontalMode: () => false, useUnmounted: () => ({ current: false }) }))
vi.mock('@/lang', () => ({ useI18n: () => (key: string) => key }))
vi.mock('@/components/SourceSelector', () => ({ useSourceListI18n: (list: string[]) => list.map(action => ({ action, label: action })) }))
vi.mock('@/utils/musicSdk', () => ({ searchMusic: async() => [] }))
vi.mock('@/utils', () => ({ toNewMusicInfo: (value: unknown) => value }))
vi.mock('./listAction', () => ({ handleShowMusicSourceDetail: vi.fn(), handleToggleSource: mocks.confirm }))
vi.mock('@/theme', () => ({ BorderRadius: {}, BorderWidths: {} }))
vi.mock('@/core/player/tempPlayList', () => ({ addTempPlayList: mocks.add }))
vi.mock('@/core/player/player', () => ({ playNext: vi.fn() }))
const song = (id: string): LX.Music.MusicInfoOnline => ({ id, name: id, singer: '', source: 'wy', interval: null, meta: { albumName: '', songId: id, qualitys: [], _qualitys: {} } })
it('real modal previews original A without legacy B, then restores A after preview C with original batch context', async() => {
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => { callback(); return 1 })
  vi.stubGlobal('i18n', { t: (key: string) => key })
  const a = song('a'); const b = song('b'); const c = song('c')
  a.meta.toggleMusicInfo = b
  const context = { listId: 'owned', musicInfo: a, isTempPlay: true }
  playerState.playMusicInfo = context
  const ref = createRef<MusicToggleModalType>()
  let tree!: ReactTestRenderer
  await act(async() => { tree = create(<MusicToggleModal ref={ref} />) })
  await act(async() => { ref.current!.show({ listId: 'owned', musicInfo: a }) })
  // The outer lazy wrapper becomes mounted first; a second show drives its real dialog.
  await act(async() => { ref.current!.show({ listId: 'owned', musicInfo: a }) })
  const renderItem = tree.root.findByType(FlatList).props.renderItem as (info: { item: LX.Music.MusicInfoOnline }) => ReactElement
  let row!: ReactTestRenderer
  await act(async() => { row = create(renderItem({ item: a })) })
  await act(async() => { row.root.findAllByType('button').at(-1)!.props.onPress() })
  expect(mocks.add.mock.lastCall![0][0].musicInfo.meta.toggleMusicInfo).toBeNull()
  await act(async() => { row.update(renderItem({ item: c })) })
  await act(async() => { row.root.findAllByType('button').at(-1)!.props.onPress() })
  const restoreText = tree.root.findAllByType(Text).find(node => node.children.includes('playback_restore_original'))!
  await act(async() => { restoreText.parent!.props.onPress() })
  expect(mocks.confirm).toHaveBeenLastCalledWith('owned', a, a, context)
  await act(async() => { row.unmount(); tree.unmount() })
  vi.unstubAllGlobals()
})
