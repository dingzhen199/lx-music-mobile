/** Preserve configured priority while excluding invalid entries and the primary. */
export const normalizeApiSourceBackups = (primaryId: string, value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && !!id.trim() && id !== primaryId))]
}
export const USER_API_INIT_TIMEOUT_MS = 10_000
