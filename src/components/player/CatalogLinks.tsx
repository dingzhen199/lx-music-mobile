import { useI18n } from '@/lang'
import { useEffect, useRef, useState } from 'react'
import { Modal, Pressable, ScrollView, View } from 'react-native'
import Text from '@/components/common/Text'
import playerState from '@/store/player/state'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { getPreferredVersion } from '@/core/music/versionPreference'
import { createCatalogState, createCatalogController } from '@/core/catalog/controller'
import { catalogAdapter } from '@/core/catalog/sdk'
import { playSelectedList } from '@/core/player/player'
import { type CatalogKind } from '@/core/catalog/types'

export default () => {
  const t = useI18n()
  const music = usePlayerMusicInfo()
  const theme = useTheme()
  const state = useRef(createCatalogState()).current
  const controller = useRef(createCatalogController(state, catalogAdapter)).current
  const [, render] = useState(0)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false; controller.close() }, [controller])
  const run = (action: () => Promise<void>) => {
    const promise = action()
    render(value => value + 1)
    void promise.finally(() => { if (mounted.current) render(value => value + 1) })
  }
  const open = (kind: CatalogKind) => {
    const current = playerState.playMusicInfo.musicInfo
    if (!current) return
    const original = 'progress' in current ? current.metadata.musicInfo : current
    run(async() => controller.open(kind, getPreferredVersion(original)))
  }
  const close = () => { controller.close(); render(value => value + 1) }
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={t('catalog_artist_action')} onPress={() => { open('artist') }}><Text numberOfLines={1} size={12}>{music.singer || t('catalog_artist')}</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={t('catalog_album_action')} onPress={() => { open('album') }}><Text numberOfLines={1} size={12}>{music.album || t('catalog_album')}</Text></Pressable>
    <Modal visible={state.show} transparent animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' }}>
        <View style={{ maxHeight: '85%', padding: 18, backgroundColor: theme['c-content-background'] }}>
          <Pressable accessibilityRole="button" onPress={close}><Text>{state.title} · {t('playback_close')}</Text></Pressable>
          {state.targets.length > 1 ? state.targets.map(target => <Pressable accessibilityRole="button" key={`${target.source}_${target.id}`} onPress={() => { run(async() => controller.select(target)) }}><Text>{target.name}</Text></Pressable>) : null}
          {state.loading ? <Text>{t('catalog_loading')}</Text> : null}
          {state.error ? <Pressable accessibilityRole="button" onPress={() => { run(controller.retry) }}><Text>{state.error} · {t('catalog_retry')}</Text></Pressable> : null}
          <Text>{t('catalog_loaded')} {state.list.length}{state.total === null ? ` ${t('catalog_unknown_total')}` : ` / ${state.total} 首`}</Text>
          <ScrollView>
            {state.list.map((item, index) => <Pressable accessibilityRole="button" key={item.id} onPress={() => { playSelectedList(state.list.slice(index)); close() }}><Text>{index + 1}. {item.name} · {item.singer}</Text></Pressable>)}
            {state.hasMore ? <Pressable accessibilityRole="button" disabled={state.loading} onPress={() => { run(controller.loadMore) }}><Text>{t('catalog_more')}</Text></Pressable> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>
}
