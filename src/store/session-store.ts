import { EventEmitter } from 'node:events'
import type { OperationLimit, UserState } from '../protocol/types.js'
import type { LogEntry } from '../utils/logger.js'

export interface SessionState {
  user: UserState
  lands: any[]
  bag: any[]
  friends: any[]
  tasks: any[]
  logs: LogEntry[]
  friendPatrolProgress: { current: number; total: number }
  friendStats: { steal: number; weed: number; bug: number; water: number }
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
    friendStats: { steal: 0, weed: 0, bug: 0, water: 0 },
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

  updateFriendStats(stats: Partial<SessionState['friendStats']>): void {
    Object.assign(this.state.friendStats, stats)
    this.emit('change', 'friendStats')
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
