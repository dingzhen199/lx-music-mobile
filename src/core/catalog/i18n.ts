const fallback = {
  catalog_artist_songs: '艺人歌曲',
  catalog_album_songs: '专辑歌曲',
  catalog_unsupported: '当前提供方暂不支持此目录',
  catalog_album_missing: '缺少准确的专辑 ID，无法打开完整目录',
  catalog_artist_missing: '歌曲详情未提供准确的艺人 ID，无法打开完整目录',
  catalog_invalid_parameters: '目录参数无效',
  catalog_invalid_response: '提供方返回的目录格式无效',
  catalog_load_error: '目录加载失败，请重试',
  catalog_no_new_songs: '提供方未返回新的目录歌曲，请重试；已加载内容仍可使用',
}
export const catalogText = (key: keyof typeof fallback): string => global.i18n?.t(key) ?? fallback[key]
