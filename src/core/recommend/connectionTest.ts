import type { RecommendLlmParams } from '@/config/recommendation'
export type ConnectionState = 'idle' | 'testing' | 'ok' | 'fail' | 'needConfig'
export const createConnectionTest = (request: (params: RecommendLlmParams) => Promise<unknown>, report: (state: ConnectionState, message: string) => void) => {
  let busy = false
  return async(params: Omit<RecommendLlmParams, 'messages'>) => {
    if (busy) return
    if (!params.apiKey.trim() || !params.model.trim()) { report('needConfig', ''); return }
    busy = true
    report('testing', '')
    try {
      await request({ ...params, apiKey: params.apiKey.trim(), model: params.model.trim(), messages: [{ role: 'user', content: '请只回复：OK' }] })
      report('ok', '')
    } catch (error) {
      // Servers may echo submitted credentials. Never display them in error text.
      report('fail', String((error as Error)?.message ?? error).split(params.apiKey).join('[redacted]').slice(0, 300))
    } finally { busy = false }
  }
}
