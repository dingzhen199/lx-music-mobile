import { useI18n } from '@/lang'
import { useEffect, useRef, useState } from 'react'
import { Modal, Pressable, FlatList, View } from 'react-native'
import Text from '@/components/common/Text'
import playerState from '@/store/player/state'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { getPreferredVersion } from '@/core/music/versionPreference'
import { createCatalogState, createCatalogController } from '@/core/catalog/controller'
import { catalogAdapter } from '@/core/catalog/sdk'
import { playMusicInfoNow, playSelectedList } from '@/core/player/player'
import { addTempPlayList } from '@/core/player/tempPlayList'
import { type CatalogKind } from '@/core/catalog/types'

export default () => {
  const t = useI18n()
  const music = usePlayerMusicInfo()
  const theme = useTheme()
  const state = useRef(createCatalogState()).current
  const controller = useRef(createCatalogController(state, catalogAdapter)).current
  const [, render] = useState(0)
  const [selected, setSelected] = useState<LX.Music.MusicInfoOnline | null>(null)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false; controller.close() }, [controller])
  const run = (action: () => Promise<void>) => {
    const promise = action()
    render(value => value + 1)
    void promise.finally(() => { if (mounted.current) render(value => value + 1) })
  }
  const open = (kind: CatalogKind) => {
    setSelected(null)
    const current = playerState.playMusicInfo.musicInfo
    if (!current) return
    const original = 'progress' in current ? current.metadata.musicInfo : current
    run(async() => controller.open(kind, getPreferredVersion(original)))
  }
  const close = () => { setSelected(null); controller.close(); render(value => value + 1) }
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={t('catalog_artist_action')} onPress={() => { open('artist') }}><Text numberOfLines={1} size={12}>{music.singer || t('catalog_artist')}</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={t('catalog_album_action')} onPress={() => { open('album') }}><Text numberOfLines={1} size={12}>{music.album || t('catalog_album')}</Text></Pressable>
    <Modal visible={state.show} transparent animationType="slide" onRequestClose={() => { if (selected) setSelected(null); else close() }}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' }}>
        <View accessibilityElementsHidden={!!selected} importantForAccessibility={selected ? 'no-hide-descendants' : 'auto'} style={{ maxHeight: '85%', padding: 18, backgroundColor: theme['c-content-background'] }}>
          <Pressable accessibilityRole="button" onPress={close}><Text>{state.title} · {t('playback_close')}</Text></Pressable>
          {state.targets.length > 1 ? state.targets.map(target => <Pressable accessibilityRole="button" key={`${target.source}_${target.id}`} onPress={() => { setSelected(null); run(async() => controller.select(target)) }}><Text>{target.name}</Text></Pressable>) : null}
          {state.loading ? <Text>{t('catalog_loading')}</Text> : null}
          {state.error ? <Pressable accessibilityRole="button" onPress={() => { run(controller.retry) }}><Text>{state.error} · {t('catalog_retry')}</Text></Pressable> : null}
          <Text>{t('catalog_loaded')} {state.list.length}{state.total === null ? ` ${t('catalog_unknown_total')}` : ` / ${state.total} ${t('catalog_songs_unit')}`}</Text>
          <FlatList
            style={{ flexGrow: 0 }} initialNumToRender={16} windowSize={5}
            data={state.list} keyExtractor={item => item.id}
            renderItem={({ item, index }) => <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable accessibilityRole="button" style={{ flex: 1, minHeight: 44, justifyContent: 'center' }} onLongPress={() => { setSelected(item) }} onPress={() => { playSelectedList(state.list.slice(index)); close() }}><Text>{index + 1}. {item.name} · {item.singer}</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`${t('catalog_song_actions')} ${item.name}`} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }} onPress={() => { setSelected(item) }}><Text>⋯</Text></Pressable>
            </View>}
            ListFooterComponent={state.hasMore ? <Pressable accessibilityRole="button" disabled={state.loading} onPress={() => { run(controller.loadMore) }}><Text>{t('catalog_more')}</Text></Pressable> : null}
          />
        </View>
        {selected ? <View accessibilityViewIsModal style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1, elevation: 1, justifyContent: 'flex-end', backgroundColor: '#0006' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('playback_close')} style={{ flex: 1 }} onPress={() => { setSelected(null) }} />
          <View style={{ padding: 18, backgroundColor: theme['c-content-background'] }}>
            <Text>{selected.name} · {selected.singer}</Text>
            <Pressable accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }} onPress={() => { playMusicInfoNow(selected); setSelected(null) }}><Text>{t('play')}</Text></Pressable>
            <Pressable accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }} onPress={() => { addTempPlayList([{ musicInfo: selected, listId: null, isTop: true }]); setSelected(null) }}><Text>{t('playback_play_next')}</Text></Pressable>
            <Pressable accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }} onPress={() => { addTempPlayList([{ musicInfo: selected, listId: null }]); setSelected(null) }}><Text>{t('play_later')}</Text></Pressable>
            <Pressable accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }} onPress={() => { setSelected(null) }}><Text>{t('playback_close')}</Text></Pressable>
          </View>
        </View> : null}
      </View>
    </Modal>
  </>
}
