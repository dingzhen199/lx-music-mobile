import { useI18n } from '@/lang'
import { useEffect, useRef, useState } from 'react'
import { Modal, Pressable, ScrollView, View } from 'react-native'
import Text from '@/components/common/Text'
import state from '@/store/player/state'
import { getNextPlayMusicInfo } from '@/core/player/player'
import { getListMusicSync } from '@/utils/listManage'
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
  const base = getListMusicSync(state.playInfo.playerListId)
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={t('playback_queue')} onPress={() => { setVisible(true) }} style={{ paddingHorizontal: 8, zIndex: 101 }}><Text size={13}>{t('playback_queue_short')}</Text></Pressable>
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { setVisible(false) }}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' }}>
        <View style={{ maxHeight: '80%', padding: 18, backgroundColor: theme['c-content-background'] }}>
          <Pressable accessibilityRole="button" onPress={() => { setVisible(false) }}><Text>{t('playback_queue')} · {t('playback_close')}</Text></Pressable>
          <Text>{t('playback_current')}：{preferred?.name ?? t('playback_none')}</Text>
          {resolved && preferred && resolved.id !== preferred.id ? <Text>{t('playback_temporary')}：{resolved.source} · {resolved.name}（{t('playback_preference_kept')}）</Text> : null}
          {state.playMusicInfo.temporarySourceUnknown ? <Text>{t('playback_rescue_unknown')}</Text> : null}
          <Text>{t('playback_next')}：{next ? songName(next.musicInfo) : t('playback_queue_end')}</Text>
          <ScrollView>
            <Text>{t('playback_pending')}</Text>
            {entries.map((item, index) => <Text key={`${index}_${item.musicInfo.id}`}>{index + 1}. {songName(item.musicInfo)}</Text>)}
            {base.length ? <>
              <Text>{t('playback_base_list')}</Text>
              {base.map((item, index) => <Text key={`${index}_${item.id}`}>{item.id === current?.id ? '▶ ' : item.id === next?.musicInfo.id ? `${t('playback_next')} · ` : ''}{index + 1}. {item.name}</Text>)}
            </> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>
}
