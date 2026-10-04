import { groupPathByBatch } from '@/core/recommend/session-core'
import { useEffect, useState } from 'react'
import { ScrollView, View, TextInput, Switch, StyleSheet } from 'react-native'
import Text from '@/components/common/Text'
import Button from '../Setting/components/Button'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { watch } from '@/core/recommend/adapters/reactive'
import { sessionView, lastErrorText, lastResultEngine, lastPlatformState, lastPlatformProviders, lastPlatformSourceError, lastAiRankError, refillState, startSession, endSession, setInstruction, setRadius, applyFeedback, playPathItem } from '@/core/recommend/session'

const snapshot = () => ({ session: sessionView.value, error: lastErrorText.value, engine: lastResultEngine.value, state: lastPlatformState.value, providers: lastPlatformProviders.value, sourceError: lastPlatformSourceError.value, aiError: lastAiRankError.value, refill: refillState.value })
export default () => {
  const theme = useTheme()
  const t = useI18n()
  const [view, setView] = useState(snapshot)
  const [instruction, changeInstruction] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const radio = useSettingValue('recommend.radio')
  const autoRefill = useSettingValue('recommend.autoRefill')
  const engine = useSettingValue('recommend.engine')
  useEffect(() => watch(snapshot, value => { setView(value) }, { deep: true }), [])
  const start = async() => {
    if (busy) return
    setBusy(true); setError('')
    try { await startSession() } catch (err: any) { setError(String(err.message)) } finally { setBusy(false) }
  }
  const session = view.session
  return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text size={22}>{t('nav_explore')}</Text>
    <View style={styles.row}><Text>{t('recommend_radio')}</Text><Switch value={radio} onValueChange={value => { updateSetting({ 'recommend.radio': value }) }} /></View>
    <View style={styles.row}><Text>{t('recommend_auto_refill')}</Text><Switch value={autoRefill} onValueChange={value => { updateSetting({ 'recommend.autoRefill': value }) }} /></View>
    <View style={styles.row}>{(['platform', 'local', 'ai'] as const).map(value => <Button key={value} disabled={engine === value} onPress={() => { updateSetting({ 'recommend.engine': value }) }}>{value}</Button>)}</View>
    <Text>{t('recommend_default_notice')}</Text>
    <View style={styles.row}><Button disabled={busy} onPress={start}>{t('recommend_start')}</Button><Button onPress={() => { updateSetting({ 'recommend.radio': false }); endSession() }}>{t('recommend_stop')}</Button></View>
    <Text>{[error, view.error, view.sourceError, view.aiError].filter(Boolean).join('\n')}</Text>
    <Text>{[view.engine, view.state, view.refill].filter(Boolean).join(' · ')}</Text>
    {view.providers.map(provider => <Text key={provider.provider}>{provider.provider}: {provider.status}{provider.fromCache ? ' (cache)' : ''}</Text>)}
    {session.active && <>
      <Text size={18}>{session.anchor.artist} — {session.anchor.title}</Text>
      <Text>{t('recommend_remaining')}: {session.remaining}</Text>
      {engine !== 'platform' && <>
        <View style={styles.row}><Button onPress={() => { setRadius(session.radius - 10) }}>−</Button><Text>{t('recommend_radius')}: {session.radius}</Text><Button onPress={() => { setRadius(session.radius + 10) }}>+</Button></View>
        <TextInput accessibilityLabel={t('recommend_instruction')} placeholder={t('recommend_instruction')} value={instruction} onChangeText={changeInstruction} style={[styles.input, { color: theme['c-font'], borderColor: theme['c-primary'] }]} />
        <Button onPress={() => { setInstruction(instruction) }}>{t('recommend_apply')}</Button>
      </>}
      <View style={styles.row}><Button onPress={() => { applyFeedback('good') }}>{t('recommend_good')}</Button><Button onPress={() => { applyFeedback(engine === 'platform' ? 'dislike' : 'far') }}>{engine === 'platform' ? t('recommend_dislike') : t('recommend_far')}</Button></View>
      {groupPathByBatch(session.path).map(group => <View key={group.key}>
        <Text size={16}>{group.batch?.engine ?? '—'}{group.batch && group.batch.engine !== 'platform' ? ` · ${t('recommend_radius')}: ${group.batch.radius} · ${t('recommend_instruction')}: ${group.batch.instruction || '—'}` : ''}</Text>
        {group.items.map((item, index) => <View key={`${item.id ?? 'item'}-${index}`} style={styles.track}>
        <Text>{item.isCurrent ? '▶ ' : ''}{item.artist} — {item.title}</Text><Text>{item.reason}</Text>
        {group.batch?.engine !== 'platform' && <Text>{item.journeyRole}</Text>}
        <Button disabled={!item.id} onPress={() => { playPathItem(item.id) }}>{t('play')}</Button>
        </View>)}
      </View>)}
    </>}
  </ScrollView>
}
const styles = StyleSheet.create({ content: { padding: 16, paddingBottom: 40 }, row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginVertical: 8 }, input: { borderWidth: 1, borderRadius: 4, padding: 8, marginVertical: 8 }, track: { marginVertical: 10 } })
