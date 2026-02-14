import { EventEmitter } from 'node:events'
import type { OperationLimit, UserState } from '../protocol/types.js'
import type { LogEntry } from '../utils/logger.js'
import { loadDailyStats, saveDailyStats } from './persist.js'

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
  friendList: FriendInfo[]
  taskList: TaskInfo[]
  operationLimits: Map<number, OperationLimit>
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
    friendList: [],
    taskList: [],
    operationLimits: new Map(),
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

  /** 累加好友统计（本轮巡查增量），并持久化到文件 */
  addFriendStats(delta: Partial<SessionState['friendStats']>): void {
    if (delta.steal) this.state.friendStats.steal += delta.steal
    if (delta.weed) this.state.friendStats.weed += delta.weed
    if (delta.bug) this.state.friendStats.bug += delta.bug
    if (delta.water) this.state.friendStats.water += delta.water
    saveDailyStats(this.state.friendStats)
    this.emit('change', 'friendStats')
  }

  /** 从持久化文件恢复当日统计 */
  restoreFriendStats(): void {
    const saved = loadDailyStats()
    if (saved) {
      Object.assign(this.state.friendStats, saved)
      this.emit('change', 'friendStats')
    }
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

  resetFriendStats(): void {
    this.state.friendStats = { steal: 0, weed: 0, bug: 0, water: 0 }
    this.emit('change', 'friendStats')
  }

  updateOperationLimit(limit: OperationLimit): void {
    this.state.operationLimits.set(limit.id, limit)
    this.emit('change', 'operationLimits')
  }
}
