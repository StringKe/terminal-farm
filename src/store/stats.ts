import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { paths } from '../config/paths.js'
import { getChinaTime, getDateKey } from '../utils/format.js'

export interface DailyStats {
  farmWeed: number
  farmBug: number
  farmWater: number
  farmHarvest: number
  farmPlant: number
  farmFertilize: number
  friendWeed: number
  friendBug: number
  friendWater: number
  friendSteal: number
  friendPutWeed: number
  friendPutBug: number
}

export interface DailyRecord {
  date: string
  stats: DailyStats
}

export interface StatsHistory {
  version: number
  records: DailyRecord[]
}

export type StatsViewMode = 'today' | 'week' | 'month' | 'total'

export const STATS_VIEW_MODES: StatsViewMode[] = ['today', 'week', 'month', 'total']

export const STATS_VIEW_LABELS: Record<StatsViewMode, string> = {
  today: '今日',
  week: '本周',
  month: '本月',
  total: '累计',
}

export function emptyDailyStats(): DailyStats {
  return {
    farmWeed: 0,
    farmBug: 0,
    farmWater: 0,
    farmHarvest: 0,
    farmPlant: 0,
    farmFertilize: 0,
    friendWeed: 0,
    friendBug: 0,
    friendWater: 0,
    friendSteal: 0,
    friendPutWeed: 0,
    friendPutBug: 0,
  }
}

interface PersistedDailyStats {
  date: string
  stats: DailyStats
  friendStats?: { steal: number; weed: number; bug: number; water: number }
}

export function loadTodayStats(): { date: string; stats: DailyStats } | null {
  try {
    if (!existsSync(paths.dailyStats)) return null
    const raw = readFileSync(paths.dailyStats, 'utf8')
    const data = JSON.parse(raw)
    const today = getDateKey()

    // 新格式
    if (data.stats && data.date) {
      if (data.date !== today) return null
      const merged = { ...emptyDailyStats(), ...data.stats }
      return { date: data.date, stats: merged }
    }

    // 旧格式: { date, friendStats: { steal, weed, bug, water } }
    if (data.friendStats && data.date) {
      if (data.date !== today) return null
      const stats = emptyDailyStats()
      stats.friendSteal = data.friendStats.steal || 0
      stats.friendWeed = data.friendStats.weed || 0
      stats.friendBug = data.friendStats.bug || 0
      stats.friendWater = data.friendStats.water || 0
      return { date: data.date, stats }
    }

    return null
  } catch {
    return null
  }
}

export function saveTodayStats(date: string, stats: DailyStats): void {
  try {
    const data: PersistedDailyStats = { date, stats }
    writeFileSync(paths.dailyStats, JSON.stringify(data, null, 2))
  } catch {}
}

export function loadHistory(): StatsHistory {
  try {
    if (!existsSync(paths.statsHistory)) return { version: 1, records: [] }
    const raw = readFileSync(paths.statsHistory, 'utf8')
    const data = JSON.parse(raw)
    if (data.version === 1 && Array.isArray(data.records)) return data
    return { version: 1, records: [] }
  } catch {
    return { version: 1, records: [] }
  }
}

export function appendToHistory(record: DailyRecord): void {
  const history = loadHistory()
  const idx = history.records.findIndex((r) => r.date === record.date)
  if (idx >= 0) {
    history.records[idx] = record
  } else {
    history.records.push(record)
    history.records.sort((a, b) => a.date.localeCompare(b.date))
  }
  try {
    writeFileSync(paths.statsHistory, JSON.stringify(history, null, 2))
  } catch {}
}

export function getWeekStart(): string {
  const cn = getChinaTime()
  const d = new Date(cn.year, cn.month - 1, cn.day)
  const dayOfWeek = d.getDay()
  // 周一为起始：Sunday=0 -> offset=6, Monday=1 -> offset=0, ...
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  d.setDate(d.getDate() - offset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function getMonthStart(): string {
  const cn = getChinaTime()
  const m = String(cn.month).padStart(2, '0')
  return `${cn.year}-${m}-01`
}

export function aggregateStats(mode: StatsViewMode, todayStats: DailyStats): DailyStats {
  if (mode === 'today') return { ...todayStats }

  const history = loadHistory()
  const result = emptyDailyStats()
  let boundary = ''

  if (mode === 'week') boundary = getWeekStart()
  else if (mode === 'month') boundary = getMonthStart()
  // total: boundary = '' means include all

  for (const record of history.records) {
    if (boundary && record.date < boundary) continue
    // 不包含今天（今天的数据来自 todayStats）
    if (record.date === getDateKey()) continue
    for (const key of Object.keys(result) as (keyof DailyStats)[]) {
      result[key] += record.stats[key] || 0
    }
  }

  // 加上今天
  for (const key of Object.keys(result) as (keyof DailyStats)[]) {
    result[key] += todayStats[key] || 0
  }

  return result
}
