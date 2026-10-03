/** Every native event carries the immutable identity of its originating runtime. */
export const createRuntimeRegistry = <T>() => {
  let generation = 0
  const session = `${Date.now()}_${Math.random().toString(36).slice(2)}`
  const entries = new Map<string, { token: string, value: T }>()
  return {
    load(id: string, value: T) {
      const token = `${session}_${++generation}`
      entries.set(id, { token, value })
      return token
    },
    get(id: string, token: string): T | undefined {
      const entry = entries.get(id)
      return entry?.token === token ? entry.value : undefined
    },
    token(id: string) { return entries.get(id)?.token },
    remove(id: string) { entries.delete(id) },
    clear() { entries.clear() },
  }
}
