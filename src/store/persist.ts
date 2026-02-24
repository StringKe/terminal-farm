import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { getDateKey } from '../utils/format.js'
import { paths } from '../config/paths.js'

const STATS_FILE = paths.dailyStats

export interface PersistedStats {
  date: string
  friendStats: { steal: number; weed: number; bug: number; water: number }
}

export function loadDailyStats(): PersistedStats['friendStats'] | null {
  try {
    if (!existsSync(STATS_FILE)) return null
    const data: PersistedStats = JSON.parse(readFileSync(STATS_FILE, 'utf8'))
    if (data.date !== getDateKey()) return null
    return data.friendStats
  } catch {
    return null
  }
}

export function saveDailyStats(friendStats: PersistedStats['friendStats']): void {
  try {
    const data: PersistedStats = { date: getDateKey(), friendStats }
    writeFileSync(STATS_FILE, JSON.stringify(data, null, 2))
  } catch {}
}
