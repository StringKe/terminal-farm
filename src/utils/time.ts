import { toNum } from './long.js'

let serverTimeMs = 0
let localTimeAtSync = 0

export function getServerTimeSec(): number {
  if (!serverTimeMs) return Math.floor(Date.now() / 1000)
  const elapsed = Date.now() - localTimeAtSync
  return Math.floor((serverTimeMs + elapsed) / 1000)
}

export function syncServerTime(ms: number): void {
  serverTimeMs = ms
  localTimeAtSync = Date.now()
}

export function toTimeSec(val: any): number {
  const n = toNum(val)
  if (n <= 0) return 0
  if (n > 1e12) return Math.floor(n / 1000)
  return n
}
