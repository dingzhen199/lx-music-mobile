/** Ordered native lifecycle stream; plain EventEmitter fallback supports portable tests. */
export const recommendEvents = {
  on(event: string, listener: (...args: any[]) => void) {
    const hub = global.app_event
    if (hub.onSync) hub.onSync(event, listener)
    else (hub.on as (name: string, callback: (...args: any[]) => void) => void)(event, listener)
  },
  off(event: string, listener: (...args: any[]) => void) {
    const hub = global.app_event
    if (hub.offSync) hub.offSync(event, listener)
    else (hub.off as (name: string, callback: (...args: any[]) => void) => void)(event, listener)
  },
}
