import { catalogText } from './i18n'
import { CatalogError, type createCatalogAdapter } from './adapter'
import { type CatalogKind, type CatalogTarget } from './types'

export const createCatalogState = () => ({
  show: false,
  title: '',
  loading: false,
  error: '',
  targets: [] as CatalogTarget[],
  target: null as CatalogTarget | null,
  list: [] as LX.Music.MusicInfoOnline[],
  page: 0,
  limit: 50,
  total: null as number | null,
  hasMore: false,
})

/** Plain state + injected SDK make stale requests and retry behavior independently testable. */
export const createCatalogController = (state: ReturnType<typeof createCatalogState>, adapter: ReturnType<typeof createCatalogAdapter>) => {
  let revision = 0
  let origin: { kind: CatalogKind, music: LX.Music.MusicInfo } | null = null
  const reportError = (error: unknown) => {
    state.error = error instanceof CatalogError ? error.message : catalogText('catalog_load_error')
  }
  const loadMore = async() => {
    if (!state.show || !state.target || state.loading || !state.hasMore) return
    const requestRevision = ++revision
    state.loading = true
    state.error = ''
    try {
      const result = await adapter.load(state.target, state.page + 1, state.limit)
      if (requestRevision !== revision || !state.show) return
      const ids = new Set(state.list.map(item => item.id))
      const additions = result.list.filter(item => {
        if (ids.has(item.id)) return false
        ids.add(item.id)
        return true
      })
      if (!additions.length && result.hasMore) throw new CatalogError('response', catalogText('catalog_no_new_songs'))
      state.list = [...state.list, ...additions]
      state.page = result.page
      state.limit = result.limit
      state.total = result.total
      state.hasMore = result.hasMore
    } catch (error) {
      if (requestRevision === revision && state.show) reportError(error)
    } finally {
      if (requestRevision === revision) state.loading = false
    }
  }
  const select = async(target: CatalogTarget) => {
    ++revision
    state.target = target
    state.title = `${target.name} · ${target.kind === 'artist' ? catalogText('catalog_artist_songs') : catalogText('catalog_album_songs')} · ${target.source}`
    state.loading = false
    state.error = ''
    state.list = []
    state.page = 0
    state.limit = 50
    state.total = null
    state.hasMore = true
    await loadMore()
  }
  const open = async(kind: CatalogKind, music: LX.Music.MusicInfo) => {
    const requestRevision = ++revision
    origin = { kind, music }
    Object.assign(state, createCatalogState(), {
      show: true,
      loading: true,
      title: `${kind === 'artist' ? music.singer : music.meta.albumName} · ${kind === 'artist' ? catalogText('catalog_artist_songs') : catalogText('catalog_album_songs')}`,
    })
    try {
      const targets = await adapter.resolve(kind, music)
      if (requestRevision !== revision || !state.show) return
      state.targets = targets
      state.loading = false
      if (targets.length === 1) await select(targets[0])
    } catch (error) {
      if (requestRevision === revision && state.show) reportError(error)
    } finally {
      if (requestRevision === revision) state.loading = false
    }
  }
  const retry = async() => {
    if (state.target) await loadMore()
    else if (origin) await open(origin.kind, origin.music)
  }
  const close = () => {
    ++revision
    state.show = false
    state.loading = false
  }
  return { open, select, loadMore, retry, close }
}
