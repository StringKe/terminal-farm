import { EventEmitter } from 'node:events'
import type { UserState } from '../protocol/types.js'
import { getDateKey } from '../utils/format.js'
import type { LogEntry } from '../utils/logger.js'
import {
  type DailyStats,
  STATS_VIEW_MODES,
  type StatsViewMode,
  appendToHistory,
  emptyDailyStats,
  loadTodayStats,
  saveTodayStats,
} from './stats.js'

export interface FriendInfo {
  gid: number
  name: string
  level: number
  actions: string[]
}

export interface TaskInfo {
  id: number
  desc: string
  progress: number
  totalProgress: number
  isUnlocked: boolean
  isClaimed: boolean
}

export interface WeatherInfo {
  currentWeatherId: number
  currentWeatherName: string
  slots: any[]
}

export interface SchedulerStatusInfo {
  resting: boolean
  restSecondsLeft: number
  intensity: 'low' | 'medium' | 'high'
  taskCount: number
  currentTask: string | null
}

export interface SessionState {
  user: UserState
  lands: any[]
  bag: any[]
  friends: any[]
  tasks: any[]
  logs: LogEntry[]
  friendPatrolProgress: { current: number; total: number }
  friendTotal: number
  friendStats: { steal: number; weed: number; bug: number; water: number }
  dailyStats: DailyStats
  statsViewMode: StatsViewMode
  friendList: FriendInfo[]
  taskList: TaskInfo[]
  weather: WeatherInfo | null
  schedulerStatus: SchedulerStatusInfo | null
}

export class SessionStore extends EventEmitter {
  readonly state: SessionState = {
    user: { gid: 0, name: '', level: 0, gold: 0, exp: 0 },
    lands: [],
    bag: [],
    friends: [],
    tasks: [],
    logs: [],
    friendPatrolProgress: { current: 0, total: 0 },
    friendTotal: 0,
    friendStats: { steal: 0, weed: 0, bug: 0, water: 0 },
    dailyStats: emptyDailyStats(),
    statsViewMode: 'today' as StatsViewMode,
    friendList: [],
    taskList: [],
    weather: null,
    schedulerStatus: null,
  }

  updateUser(user: Partial<UserState>): void {
    Object.assign(this.state.user, user)
    this.emit('change', 'user')
  }

  updateLands(lands: any[]): void {
    this.state.lands = lands
    this.emit('change', 'lands')
  }

  updateBag(bag: any[]): void {
    this.state.bag = bag
    this.emit('change', 'bag')
  }

  updateFriends(friends: any[]): void {
    this.state.friends = friends
    this.emit('change', 'friends')
  }

  updateTasks(tasks: any[]): void {
    this.state.tasks = tasks
    this.emit('change', 'tasks')
  }

  pushLog(entry: LogEntry): void {
    this.state.logs.push(entry)
    if (this.state.logs.length > 500) this.state.logs.shift()
    this.emit('change', 'logs')
  }

  updateFriendPatrol(current: number, total: number): void {
    this.state.friendPatrolProgress = { current, total }
    this.emit('change', 'friendPatrol')
  }

  private lastStatsDate = ''

  /** 累加统计（支持全部 12 个指标），自动跨日归档 */
  addStats(delta: Partial<DailyStats>): void {
    const today = getDateKey()
    if (this.lastStatsDate && this.lastStatsDate !== today) {
      appendToHistory({ date: this.lastStatsDate, stats: { ...this.state.dailyStats } })
      this.state.dailyStats = emptyDailyStats()
      this.state.friendStats = { steal: 0, weed: 0, bug: 0, water: 0 }
    }
    this.lastStatsDate = today

    for (const key of Object.keys(delta) as (keyof DailyStats)[]) {
      if (delta[key]) this.state.dailyStats[key] += delta[key]!
    }

    // 同步旧 friendStats 字段
    this.state.friendStats.steal = this.state.dailyStats.friendSteal
    this.state.friendStats.weed = this.state.dailyStats.friendWeed
    this.state.friendStats.bug = this.state.dailyStats.friendBug
    this.state.friendStats.water = this.state.dailyStats.friendWater

    saveTodayStats(today, this.state.dailyStats)
    this.emit('change', 'dailyStats')
    this.emit('change', 'friendStats')
  }

  /** 从持久化文件恢复当日统计 */
  restoreStats(): void {
    const saved = loadTodayStats()
    if (saved) {
      this.state.dailyStats = saved.stats
      this.lastStatsDate = saved.date
      this.state.friendStats.steal = saved.stats.friendSteal
      this.state.friendStats.weed = saved.stats.friendWeed
      this.state.friendStats.bug = saved.stats.friendBug
      this.state.friendStats.water = saved.stats.friendWater
      this.emit('change', 'dailyStats')
      this.emit('change', 'friendStats')
    }
  }

  /** 切换统计视图模式 */
  cycleStatsView(direction: 1 | -1): void {
    const idx = STATS_VIEW_MODES.indexOf(this.state.statsViewMode)
    const next = (idx + direction + STATS_VIEW_MODES.length) % STATS_VIEW_MODES.length
    this.state.statsViewMode = STATS_VIEW_MODES[next]
    this.emit('change', 'statsViewMode')
  }

  updateFriendList(list: FriendInfo[], total?: number): void {
    this.state.friendList = list
    if (total !== undefined) this.state.friendTotal = total
    this.emit('change', 'friendList')
  }

  updateFriendActions(gid: number, actions: string[]): void {
    const friend = this.state.friendList.find((f) => f.gid === gid)
    if (friend) {
      friend.actions = actions
      this.emit('change', 'friendList')
    }
  }

  updateTaskList(list: TaskInfo[]): void {
    this.state.taskList = list
    this.emit('change', 'taskList')
  }

  updateWeather(weather: WeatherInfo): void {
    this.state.weather = weather
    this.emit('change', 'weather')
  }

  updateSchedulerStatus(status: SchedulerStatusInfo): void {
    this.state.schedulerStatus = status
    this.emit('change', 'schedulerStatus')
  }
}
