// import mitt from 'mitt'
// import type { Emitter } from 'mitt'

export default class Event {
  private readonly synchronous = new Map<string, Array<(...args: any[]) => any>>()
  listeners: Map<string, Array<(...args: any[]) => any>>
  constructor() {
    this.listeners = new Map()
  }

  on(eventName: string, listener: (...args: any[]) => any) {
    let targetListeners = this.listeners.get(eventName)
    if (!targetListeners) this.listeners.set(eventName, targetListeners = [])
    targetListeners.push(listener)
  }

  off(eventName: string, listener: (...args: any[]) => any) {
    let targetListeners = this.listeners.get(eventName)
    if (!targetListeners) return
    const index = targetListeners.indexOf(listener)
    if (index < 0) return
    targetListeners.splice(index, 1)
  }

  // Internal lifecycle observers need mutation-order delivery. Existing UI listeners remain asynchronous.
  onSync(eventName: string, listener: (...args: any[]) => any) {
    const listeners = this.synchronous.get(eventName) ?? []
    listeners.push(listener)
    this.synchronous.set(eventName, listeners)
  }

  offSync(eventName: string, listener: (...args: any[]) => any) {
    const listeners = this.synchronous.get(eventName)
    const index = listeners?.indexOf(listener) ?? -1
    if (index >= 0) listeners!.splice(index, 1)
  }

  emit(eventName: string, ...args: any[]) {
    for (const listener of [...(this.synchronous.get(eventName) ?? [])]) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Generic event transport; typed event hubs validate each listener signature.
      try { listener(...args) } catch (error) { console.warn('[event] synchronous observer failed', eventName, error) }
    }
    setImmediate(() => {
      let targetListeners = this.listeners.get(eventName)
      if (!targetListeners) return
      for (const listener of targetListeners) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        listener(...args)
      }
    })
  }

  offAll(eventName: string) {
    this.synchronous.delete(eventName)
    let targetListeners = this.listeners.get(eventName)
    if (!targetListeners) return
    this.listeners.delete(eventName)
  }
}

// export class App_EVENT {
//   listeners: Map<string, Array<() => void>>
//   constructor() {
//     this.listeners = new Map()
//   }

//   on(eventName: string, listener: () => void) {
//     let targetListeners = this.listeners.get(eventName)
//     if (targetListeners) this.listeners.set(eventName, targetListeners = [])
//     targetListeners!.push(listener)
//   }

//   off(eventName: string, listener: () => void) {

//   }
// }

