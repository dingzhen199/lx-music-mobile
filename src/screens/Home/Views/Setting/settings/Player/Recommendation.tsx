import { clampRadius } from '@/core/recommend/session-core'
import settingState from '@/store/setting/state'
import { llmComplete } from '@/core/recommend/llm'
import { createConnectionTest, type ConnectionState } from '@/core/recommend/connectionTest'
import { View, Switch, TextInput, StyleSheet, PermissionsAndroid, Platform } from 'react-native'
import { useState, useMemo, useEffect, useRef } from 'react'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import Button from '../../components/Button'
import { useTheme } from '@/store/theme/hook'

const Field = ({ name, secret = false }: { name: 'ai.baseUrl' | 'ai.apiKey' | 'ai.model', secret?: boolean }) => {
  const value = useSettingValue(name)
  const [text, setText] = useState(value)
  const theme = useTheme()
  return <TextInput accessibilityLabel={name} placeholder={name} value={text} onChangeText={setText} onEndEditing={() => { updateSetting({ [name]: text.trim() }) }} secureTextEntry={secret} autoCapitalize="none" autoCorrect={false} style={[styles.input, { color: theme['c-font'], borderColor: theme['c-primary'] }]} />
}
export default () => {
  const t = useI18n()
  const [testState, setTestState] = useState<ConnectionState>('idle')
  const [testMessage, setTestMessage] = useState('')
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])
  const test = useMemo(() => createConnectionTest(llmComplete, (state, message) => {
    if (mounted.current) { setTestState(state); setTestMessage(message) }
  }), [])
  const testConnect = async() => {
    const setting = settingState.setting
    await test({ protocol: setting['ai.provider'], baseUrl: setting['ai.baseUrl'].trim(), apiKey: setting['ai.apiKey'], model: setting['ai.model'] })
  }
  const enabled = useSettingValue('ai.enable')
  const audioAnalysis = useSettingValue('ai.audioAnalysisEnabled')
  const [audioMessage, setAudioMessage] = useState('')
  const [audioPending, setAudioPending] = useState(false)
  const toggleAnalysis = async(value: boolean) => {
    if (!value) { updateSetting({ 'ai.audioAnalysisEnabled': false }); return }
    if (Platform.OS !== 'android') { setAudioMessage(t('recommend_audio_unavailable')); return }
    if (audioPending) return
    setAudioPending(true)
    try {
      const permission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)
      if (!mounted.current) return
      if (permission === PermissionsAndroid.RESULTS.GRANTED) updateSetting({ 'ai.audioAnalysisEnabled': true })
      else setAudioMessage(t('recommend_audio_permission'))
    } catch {
      if (mounted.current) setAudioMessage(t('recommend_audio_unavailable'))
    } finally { if (mounted.current) setAudioPending(false) }
  }
  const radio = useSettingValue('recommend.radio')
  const provider = useSettingValue('ai.provider')
  const concurrency = useSettingValue('ai.maxConcurrentRequests')
  const engine = useSettingValue('recommend.engine')
  const radius = clampRadius(useSettingValue('recommend.radius'))
  return <View style={styles.container}>
    <Text size={18}>{t('nav_explore')}</Text>
    <View style={styles.row}><Text>{t('recommend_radio')}</Text><Switch value={radio} onValueChange={value => { updateSetting({ 'recommend.radio': value }) }} /></View>
    {engine !== 'platform' && <View style={styles.row}><Button onPress={() => { updateSetting({ 'recommend.radius': clampRadius(radius - 5) }) }}>−</Button><Text>{t('recommend_default_radius')}: {radius}</Text><Button onPress={() => { updateSetting({ 'recommend.radius': clampRadius(radius + 5) }) }}>+</Button></View>}
    <Text>{t('recommend_ai_privacy')}</Text>
    <View style={styles.row}><Text>{t('recommend_audio_analysis')}</Text><Switch disabled={audioPending} value={audioAnalysis} onValueChange={toggleAnalysis} /></View>
    <Text>{t('recommend_audio_notice')}{audioMessage ? `\n${audioMessage}` : ''}</Text>
    <View style={styles.row}><Text>AI</Text><Switch value={enabled} onValueChange={value => { updateSetting({ 'ai.enable': value }) }} /></View>
    <View style={styles.row}>{(['openai-compatible', 'anthropic'] as const).map(value => <Button key={value} disabled={value === provider} onPress={() => { updateSetting({ 'ai.provider': value }) }}>{value}</Button>)}</View>
    <Field name="ai.baseUrl" /><Field name="ai.apiKey" secret /><Field name="ai.model" />
    <Button disabled={testState === 'testing'} onPress={testConnect}>{t('recommend_test_connection')}</Button>
    <Text>{testState === 'idle' ? '' : testState === 'testing' ? t('recommend_testing') : testState === 'ok' ? t('recommend_test_ok') : testState === 'needConfig' ? t('recommend_test_need_config') : `${t('recommend_test_fail')}: ${testMessage}`}</Text>
    <View style={styles.row}><Button onPress={() => { updateSetting({ 'ai.maxConcurrentRequests': Math.max(1, concurrency - 1) }) }}>−</Button><Text>{t('recommend_concurrency')}: {concurrency}</Text><Button onPress={() => { updateSetting({ 'ai.maxConcurrentRequests': Math.min(8, concurrency + 1) }) }}>+</Button></View>
  </View>
}
const styles = StyleSheet.create({ container: { margin: 16 }, row: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 }, input: { borderWidth: 1, borderRadius: 4, padding: 8, marginVertical: 5 } })
