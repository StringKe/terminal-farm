import { useCallback, useEffect, useState } from 'react'
import type { AccountInfo, AccountStore } from '../../store/account-store.js'
import type { SessionState, SessionStore } from '../../store/session-store.js'
import { type LogEntry, getLogRingBuffer, onLog } from '../../utils/logger.js'

export function useSessionState(store: SessionStore | null): SessionState | null {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!store) return
    const handler = () => setTick((t) => t + 1)
    store.on('change', handler)
    return () => {
      store.off('change', handler)
    }
  }, [store])

  return store?.state ?? null
}

export function useAccounts(store: AccountStore): {
  accounts: readonly AccountInfo[]
  currentIndex: number
} {
  const [, setTick] = useState(0)

  useEffect(() => {
    const handler = () => setTick((t) => t + 1)
    store.on('change', handler)
    return () => {
      store.off('change', handler)
    }
  }, [store])

  return {
    accounts: store.getAccounts(),
    currentIndex: store.getCurrentIndex(),
  }
}

export function useStoreField<T>(store: SessionStore | null, selector: (state: SessionState) => T): T | null {
  const [value, setValue] = useState<T | null>(() => (store ? selector(store.state) : null))

  const selectorRef = useCallback(selector, [])

  useEffect(() => {
    if (!store) {
      setValue(null)
      return
    }
    setValue(selectorRef(store.state))
    const handler = () => setValue(selectorRef(store.state))
    store.on('change', handler)
    return () => {
      store.off('change', handler)
    }
  }, [store, selectorRef])

  return value
}

/** 监听全局 logger ring buffer，每次新日志触发 re-render */
export function useGlobalLogs(): LogEntry[] {
  const [logs, setLogs] = useState<LogEntry[]>(() => [...getLogRingBuffer()])

  useEffect(() => {
    return onLog(() => {
      setLogs([...getLogRingBuffer()])
    })
  }, [])

  return logs
}
