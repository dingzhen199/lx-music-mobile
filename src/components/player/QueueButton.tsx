import { useI18n } from '@/lang'
import { useEffect, useRef, useState } from 'react'
import { Alert, Modal, Pressable, FlatList, View } from 'react-native'
import Text from '@/components/common/Text'
import state from '@/store/player/state'
import { getNextPlayMusicInfo, playQueueItem, moveQueueItem, removeQueueItem, clearPlaybackQueue, queueItemNext } from '@/core/player/player'
import { addTempPlayList } from '@/core/player/tempPlayList'
import { getList } from '@/core/player/playInfo'
import { useTheme } from '@/store/theme/hook'
import { getPreferredVersion } from '@/core/music/versionPreference'

const songName = (music: LX.Player.PlayMusic) => 'progress' in music ? music.metadata.musicInfo.name : getPreferredVersion(music).name

export default () => {
  const theme = useTheme()
  const t = useI18n()
  const [visible, setVisible] = useState(false)
  const [next, setNext] = useState<LX.Player.PlayMusicInfo | null>(null)
  const [, render] = useState(0)
  const revision = useRef(0)
  useEffect(() => {
    if (!visible) return
    const requests = revision
    const refresh = () => {
      const request = ++requests.current
      render(value => value + 1)
      void getNextPlayMusicInfo().then(value => { if (request === requests.current) setNext(value) }).catch(() => { if (request === requests.current) setNext(null) })
    }
    refresh()
    global.state_event.on('playMusicInfoChanged', refresh)
    global.state_event.on('playTempPlayListChanged', refresh)
    global.state_event.on('playInfoChanged', refresh)
    global.state_event.on('configUpdated', refresh)
    global.app_event.on('myListMusicUpdate', refresh)
    return () => {
      ++requests.current
      global.state_event.off('playMusicInfoChanged', refresh)
      global.state_event.off('playTempPlayListChanged', refresh)
      global.state_event.off('playInfoChanged', refresh)
      global.state_event.off('configUpdated', refresh)
      global.app_event.off('myListMusicUpdate', refresh)
    }
  }, [visible])
  const current = state.playMusicInfo.musicInfo
  const original = current && ('progress' in current ? current.metadata.musicInfo : current)
  const preferred = original && getPreferredVersion(original)
  const resolved = state.playMusicInfo.resolvedMusicInfo
  const entries = state.tempPlayList
  const base = getList(state.playInfo.playerListId)
  const [error, setError] = useState('')
  const busy = useRef(false)
  const run = async(action: () => Promise<void>) => {
    if (busy.current) return
    busy.current = true
    try { setError(''); await action() } catch { setError(t('playback_action_failed')) } finally { busy.current = false }
  }
  const clear = () => {
    Alert.alert(t('playback_clear'), t('playback_clear_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('playback_clear'), style: 'destructive', onPress: clearPlaybackQueue },
    ])
  }
  const rows: Array<{ key: string, label: string, section?: 'base' | 'pending', entry?: LX.Player.PlayMusic | LX.Player.PlayMusicInfo, index?: number, count?: number }> = [
    { key: 'pending-label', label: t('playback_pending') },
    ...entries.map((entry, index) => ({ key: `pending-${index}`, label: `${index + 1}. ${songName(entry.musicInfo)}`, section: 'pending' as const, entry, index, count: entries.length })),
    ...(base.length ? [{ key: 'base-label', label: t('playback_base_list') }, ...base.map((entry, index) => ({ key: `base-${entry.id}`, label: `${entry.id === current?.id ? '▶ ' : ''}${index + 1}. ${songName(entry)}`, section: 'base' as const, entry, index, count: base.length }))] : []),
  ]
  const buttonStyle = { minHeight: 44, minWidth: 44, padding: 10, justifyContent: 'center' as const }
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={t('playback_queue')} onPress={() => { setVisible(true) }} style={{ paddingHorizontal: 8, zIndex: 101 }}><Text size={13}>{t('playback_queue_short')}</Text></Pressable>
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { setVisible(false) }}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' }}>
        <View style={{ maxHeight: '80%', padding: 18, backgroundColor: theme['c-content-background'] }}>
          <Pressable accessibilityRole="button" onPress={() => { setVisible(false) }}><Text>{t('playback_queue')} · {t('playback_close')}</Text></Pressable>
          {state.exclusiveBatch ? <Text>{t('playback_batch_radio_paused')}</Text> : null}
          <Text>{t('playback_current')}：{preferred?.name ?? t('playback_none')}</Text>
          {resolved && preferred && resolved.id !== preferred.id ? <Text>{t('playback_temporary')}：{resolved.source} · {resolved.name}（{t('playback_preference_kept')}）</Text> : null}
          {state.playMusicInfo.temporarySourceUnknown ? <Text>{t('playback_rescue_unknown')}</Text> : null}
          <Text>{t('playback_next')}：{next ? songName(next.musicInfo) : t('playback_queue_end')}</Text>
          {error ? <Text>{error}</Text> : null}
          <Pressable accessibilityRole="button" style={buttonStyle} onPress={clear}><Text>{t('playback_clear')}</Text></Pressable>
          <FlatList
            style={{ flexGrow: 0 }} initialNumToRender={16} windowSize={5}
            data={rows}
            keyExtractor={item => item.key}
            renderItem={({ item }) => {
              const { section, entry } = item
              if (!section || !entry) return <Text>{item.label}</Text>
              return <View style={{ paddingVertical: 6 }}>
                <Pressable accessibilityRole="button" accessibilityLabel={`${t('play')} ${item.label}`} style={buttonStyle} onPress={() => { void run(async() => playQueueItem(section, entry)) }}><Text>{item.label}</Text></Pressable>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  <Pressable accessibilityRole="button" style={buttonStyle} onPress={() => { queueItemNext(section, entry) }}><Text>{t('playback_play_next')}</Text></Pressable>
                  {section === 'base' ? <Pressable accessibilityRole="button" style={buttonStyle} onPress={() => { addTempPlayList([{ musicInfo: entry as LX.Player.PlayMusic, listId: state.playInfo.playerListId }]) }}><Text>{t('play_later')}</Text></Pressable> : null}
                  <Pressable accessibilityRole="button" accessibilityLabel={t('playback_move_up')} disabled={item.index === 0} style={buttonStyle} onPress={() => { moveQueueItem(section, entry, -1) }}><Text>{t('playback_move_up')}</Text></Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={t('playback_move_down')} disabled={item.index === item.count! - 1} style={buttonStyle} onPress={() => { moveQueueItem(section, entry, 1) }}><Text>{t('playback_move_down')}</Text></Pressable>
                  <Pressable accessibilityRole="button" style={buttonStyle} onPress={() => { void run(async() => removeQueueItem(section, entry)) }}><Text>{t('playback_remove')}</Text></Pressable>
                </View>
              </View>
            }}
          />
        </View>
      </View>
    </Modal>
  </>
}
