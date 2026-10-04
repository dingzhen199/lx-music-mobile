import { beforeEach, expect, it, vi } from 'vitest'
import { create, act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import Explore from './index'
import RecommendationSettings from '../Setting/settings/Player/Recommendation'
const state = vi.hoisted(() => {
  const settings: Record<string, any> = { 'recommend.engine': 'local', 'recommend.radius': 35, 'recommend.radio': false, 'recommend.autoRefill': true, 'ai.enable': false, 'ai.audioAnalysisEnabled': false, 'ai.provider': 'openai-compatible', 'ai.maxConcurrentRequests': 3, 'ai.baseUrl': '', 'ai.apiKey': '', 'ai.model': '' }
  return {
    settings,
    update: vi.fn(),
    radius: vi.fn(),
    session: { active: true, anchor: { artist: 'Anchor', title: 'Song' }, radius: 35, remaining: 0, path: [] as any[] },
  }
})
vi.mock('react-native', () => ({ View: 'View', TextInput: 'TextInput', Switch: 'Switch', ScrollView: 'ScrollView', StyleSheet: { create: (styles: unknown) => styles }, Platform: { OS: 'android' }, PermissionsAndroid: { PERMISSIONS: {}, RESULTS: {} } }))
vi.mock('@/components/common/Text', () => ({ default: 'span' }))
vi.mock('@/screens/Home/Views/Setting/components/Button', () => ({ default: 'button' }))
vi.mock('@/store/theme/hook', () => ({ useTheme: () => ({ 'c-font': '#000', 'c-primary': '#080' }) }))
vi.mock('@/lang', () => ({ useI18n: () => (key: string) => key }))
vi.mock('@/store/setting/hook', () => ({ useSettingValue: (key: string) => state.settings[key] }))
vi.mock('@/core/common', () => ({ updateSetting: state.update }))
vi.mock('@/core/recommend/llm', () => ({ llmComplete: vi.fn() }))
vi.mock('@/core/recommend/adapters/reactive', () => ({ watch: () => () => {} }))
vi.mock('@/core/recommend/session', () => ({
  sessionView: { value: state.session },
  lastErrorText: { value: '' },
  lastResultEngine: { value: 'platform' },
  lastPlatformState: { value: 'ok' },
  lastPlatformProviders: { value: [] },
  lastPlatformSourceError: { value: '' },
  lastAiRankError: { value: '' },
  refillState: { value: 'idle' },
  startSession: vi.fn(),
  endSession: vi.fn(),
  setInstruction: vi.fn(),
  setRadius: state.radius,
  applyFeedback: vi.fn(),
  playPathItem: vi.fn(),
}))
const text = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : text(child)).join('')
beforeEach(() => { vi.clearAllMocks(); state.settings['recommend.engine'] = 'local'; state.settings['recommend.radius'] = 35 })
it('real settings control persists a new-run radius rather than mutating the active session', async() => {
  let tree!: ReactTestRenderer
  await act(async() => { tree = create(<RecommendationSettings />) })
  const label = tree.root.findAll(node => node.type === 'span' && text(node).startsWith('recommend_default_radius'))[0]
  const buttons = label.parent!.findAll(node => node.type === 'button')
  await act(async() => { buttons[1].props.onPress() })
  expect(state.update).toHaveBeenCalledWith({ 'recommend.radius': 40 })
  expect(state.radius).not.toHaveBeenCalled()
  await act(async() => { tree.unmount() })
  state.settings['recommend.engine'] = 'platform'
  await act(async() => { tree = create(<RecommendationSettings />) })
  expect(tree.root.findAll(node => node.type === 'span' && text(node).startsWith('recommend_default_radius'))).toHaveLength(0)
  await act(async() => { tree.unmount() })
})
it('real Explore groups immutable batch policy while platform headers omit radius/instruction', async() => {
  state.settings['recommend.engine'] = 'platform'
  state.session.path = [
    { id: 'one', artist: 'A', title: 'One', reason: '', journeyRole: 'hold', batch: { engine: 'local', radius: 15, instruction: 'first constraint' } },
    { id: 'two', artist: 'B', title: 'Two', reason: '', journeyRole: 'open', batch: { engine: 'ai', radius: 70, instruction: 'later constraint' } },
    { id: 'three', artist: 'C', title: 'Three', reason: '', journeyRole: 'open', batch: { engine: 'platform', radius: 999, instruction: 'must not display' } },
  ]
  let tree!: ReactTestRenderer
  await act(async() => { tree = create(<Explore />) })
  const labels = tree.root.findAll(node => node.type === 'span').map(text)
  expect(labels).toContain('local · recommend_radius: 15 · recommend_instruction: first constraint')
  expect(labels).toContain('ai · recommend_radius: 70 · recommend_instruction: later constraint')
  expect(labels).toContain('platform')
  expect(labels.join('\n')).not.toContain('must not display')
  expect(labels.join('\n')).not.toContain('999')
  await act(async() => { tree.unmount() })
})
