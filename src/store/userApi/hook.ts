import { useEffect, useState } from 'react'
import { state } from './state'
import { event } from './event'

export const useStatus = () => {
  const [value, update] = useState(state.status)

  useEffect(() => {
    event.on('status_changed', update)
    return () => {
      event.off('status_changed', update)
    }
  }, [])

  return value
}

export const useUserApiList = () => {
  const [value, update] = useState(state.list)

  useEffect(() => {
    event.on('list_changed', update)
    return () => {
      event.off('list_changed', update)
    }
  }, [])

  return value
}

export const useApiStatuses = () => {
  const [value, update] = useState({ ...state.statuses })
  useEffect(() => {
    const changed = () => { update({ ...state.statuses }) }
    event.on('runtimes_changed', changed)
    return () => { event.off('runtimes_changed', changed) }
  }, [])
  return value
}
