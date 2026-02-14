import { AccountStore } from './account-store.js'
import { SessionStore } from './session-store.js'

export const accountStore = new AccountStore()
const sessionStores = new Map<string, SessionStore>()

export function registerSessionStore(accountId: string, store: SessionStore): void {
  sessionStores.set(accountId, store)
}

export function getSessionStore(accountId: string): SessionStore {
  let store = sessionStores.get(accountId)
  if (!store) {
    store = new SessionStore()
    sessionStores.set(accountId, store)
  }
  return store
}

export function removeSessionStore(accountId: string): void {
  sessionStores.delete(accountId)
}

export { AccountStore } from './account-store.js'
export { SessionStore } from './session-store.js'
