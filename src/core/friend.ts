import { getPlantName } from '../config/game-data.js'
import { OP_NAMES, PlantPhase, config } from '../config/index.js'
import type { Connection } from '../protocol/connection.js'
import { types } from '../protocol/proto-loader.js'
import type { SessionStore } from '../store/session-store.js'
import { getDateKey } from '../utils/format.js'
import { log, logWarn, sleep } from '../utils/logger.js'
import { toLong, toNum } from '../utils/long.js'
import type { FarmManager } from './farm.js'

const HELP_ONLY_WITH_EXP = true
const _ENABLE_PUT_BAD_THINGS = false

export class FriendManager {
  private isChecking = false
  private loopRunning = false
  private loopTimer: ReturnType<typeof setTimeout> | null = null
  private acceptTimer: ReturnType<typeof setTimeout> | null = null
  private lastResetDate = ''
  private expTracker = new Map<number, number>()
  private expExhausted = new Set<number>()
  private operationLimits = new Map<
    number,
    { dayTimes: number; dayTimesLimit: number; dayExpTimes: number; dayExpTimesLimit: number }
  >()

  constructor(
    private conn: Connection,
    private store: SessionStore,
    private farm: FarmManager,
  ) {}

  private checkDailyReset(): void {
    const today = getDateKey()
    if (this.lastResetDate !== today) {
      if (this.lastResetDate !== '') log('系统', '跨日重置，清空操作限制缓存')
      this.operationLimits.clear()
      this.expExhausted.clear()
      this.expTracker.clear()
      this.lastResetDate = today
    }
  }

  updateOperationLimits(limits: any[]): void {
    if (!limits?.length) return
    this.checkDailyReset()
    for (const limit of limits) {
      const id = toNum(limit.id)
      if (id <= 0) continue
      const newExpTimes = toNum(limit.day_exp_times)
      this.operationLimits.set(id, {
        dayTimes: toNum(limit.day_times),
        dayTimesLimit: toNum(limit.day_times_lt),
        dayExpTimes: newExpTimes,
        dayExpTimesLimit: toNum(limit.day_ex_times_lt),
      })
      if (this.expTracker.has(id)) {
        const prevExpTimes = this.expTracker.get(id)!
        this.expTracker.delete(id)
        if (newExpTimes <= prevExpTimes && !this.expExhausted.has(id)) {
          this.expExhausted.add(id)
          log('限制', `${OP_NAMES[id] || `#${id}`} 经验已耗尽 (已获${newExpTimes}次)`)
        }
      }
    }
  }

  private canGetExp(opId: number): boolean {
    if (this.expExhausted.has(opId)) return false
    const limit = this.operationLimits.get(opId)
    if (!limit) return true
    if (limit.dayExpTimesLimit > 0) return limit.dayExpTimes < limit.dayExpTimesLimit
    return true
  }

  private canOperate(opId: number): boolean {
    const limit = this.operationLimits.get(opId)
    if (!limit) return true
    if (limit.dayTimesLimit <= 0) return true
    return limit.dayTimes < limit.dayTimesLimit
  }

  private markExpCheck(opId: number): void {
    const limit = this.operationLimits.get(opId)
    if (limit) this.expTracker.set(opId, limit.dayExpTimes)
  }

  private getRemainingTimes(opId: number): number {
    const limit = this.operationLimits.get(opId)
    if (!limit || limit.dayTimesLimit <= 0) return 999
    return Math.max(0, limit.dayTimesLimit - limit.dayTimes)
  }

  private async getAllFriends(): Promise<any> {
    const body = types.GetAllFriendsRequest.encode(types.GetAllFriendsRequest.create({})).finish()
    const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.friendpb.FriendService', 'GetAll', body)
    return types.GetAllFriendsReply.decode(replyBody)
  }

  private async enterFriendFarm(friendGid: number): Promise<any> {
    const body = types.VisitEnterRequest.encode(
      types.VisitEnterRequest.create({ host_gid: toLong(friendGid), reason: 2 }),
    ).finish()
    const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.visitpb.VisitService', 'Enter', body)
    return types.VisitEnterReply.decode(replyBody)
  }

  private async leaveFriendFarm(friendGid: number): Promise<void> {
    const body = types.VisitLeaveRequest.encode(
      types.VisitLeaveRequest.create({ host_gid: toLong(friendGid) }),
    ).finish()
    try {
      await this.conn.sendMsgAsync('gamepb.visitpb.VisitService', 'Leave', body)
    } catch {}
  }

  private async helpWater(gid: number, landIds: number[]): Promise<any> {
    const body = types.WaterLandRequest.encode(
      types.WaterLandRequest.create({ land_ids: landIds, host_gid: toLong(gid) }),
    ).finish()
    const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.plantpb.PlantService', 'WaterLand', body)
    const reply = types.WaterLandReply.decode(replyBody) as any
    this.updateOperationLimits(reply.operation_limits)
    return reply
  }

  private async helpWeed(gid: number, landIds: number[]): Promise<any> {
    const body = types.WeedOutRequest.encode(
      types.WeedOutRequest.create({ land_ids: landIds, host_gid: toLong(gid) }),
    ).finish()
    const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.plantpb.PlantService', 'WeedOut', body)
    const reply = types.WeedOutReply.decode(replyBody) as any
    this.updateOperationLimits(reply.operation_limits)
    return reply
  }

  private async helpInsecticide(gid: number, landIds: number[]): Promise<any> {
    const body = types.InsecticideRequest.encode(
      types.InsecticideRequest.create({ land_ids: landIds, host_gid: toLong(gid) }),
    ).finish()
    const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.plantpb.PlantService', 'Insecticide', body)
    const reply = types.InsecticideReply.decode(replyBody) as any
    this.updateOperationLimits(reply.operation_limits)
    return reply
  }

  private async stealHarvest(gid: number, landIds: number[]): Promise<any> {
    const body = types.HarvestRequest.encode(
      types.HarvestRequest.create({ land_ids: landIds, host_gid: toLong(gid), is_all: true }),
    ).finish()
    const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.plantpb.PlantService', 'Harvest', body)
    const reply = types.HarvestReply.decode(replyBody) as any
    this.updateOperationLimits(reply.operation_limits)
    return reply
  }

  private analyzeFriendLands(lands: any[], myGid: number) {
    const result = {
      stealable: [] as number[],
      stealableInfo: [] as any[],
      needWater: [] as number[],
      needWeed: [] as number[],
      needBug: [] as number[],
      canPutWeed: [] as number[],
      canPutBug: [] as number[],
    }
    for (const land of lands) {
      const id = toNum(land.id)
      const plant = land.plant
      if (!plant?.phases?.length) continue
      const currentPhase = this.farm.getCurrentPhase(plant.phases)
      if (!currentPhase) continue
      const phaseVal = currentPhase.phase
      if (phaseVal === PlantPhase.MATURE) {
        if (plant.stealable) {
          result.stealable.push(id)
          result.stealableInfo.push({
            landId: id,
            plantId: toNum(plant.id),
            name: getPlantName(toNum(plant.id)) || plant.name,
          })
        }
        continue
      }
      if (phaseVal === PlantPhase.DEAD) continue
      if (toNum(plant.dry_num) > 0) result.needWater.push(id)
      if (plant.weed_owners?.length > 0) result.needWeed.push(id)
      if (plant.insect_owners?.length > 0) result.needBug.push(id)
      const weedOwners = plant.weed_owners || []
      const insectOwners = plant.insect_owners || []
      if (weedOwners.length < 2 && !weedOwners.some((g: any) => toNum(g) === myGid)) result.canPutWeed.push(id)
      if (insectOwners.length < 2 && !insectOwners.some((g: any) => toNum(g) === myGid)) result.canPutBug.push(id)
    }
    return result
  }

  private async visitFriend(
    friend: { gid: number; name: string },
    totalActions: Record<string, number>,
  ): Promise<void> {
    let enterReply: any
    try {
      enterReply = await this.enterFriendFarm(friend.gid)
    } catch (e: any) {
      logWarn('好友', `进入 ${friend.name} 农场失败: ${e.message}`)
      return
    }
    const lands = enterReply.lands || []
    if (!lands.length) {
      await this.leaveFriendFarm(friend.gid)
      return
    }
    const status = this.analyzeFriendLands(lands, this.conn.userState.gid)
    const actions: string[] = []
    // Help operations
    for (const [opId, landIds, helpFn, label] of [
      [10005, status.needWeed, (gid: number, ids: number[]) => this.helpWeed(gid, ids), '草'] as const,
      [10006, status.needBug, (gid: number, ids: number[]) => this.helpInsecticide(gid, ids), '虫'] as const,
      [10007, status.needWater, (gid: number, ids: number[]) => this.helpWater(gid, ids), '水'] as const,
    ]) {
      if (landIds.length > 0 && (!HELP_ONLY_WITH_EXP || this.canGetExp(opId))) {
        this.markExpCheck(opId)
        let ok = 0
        for (const landId of landIds) {
          try {
            await helpFn(friend.gid, [landId])
            ok++
          } catch {}
          await sleep(100)
        }
        if (ok > 0) {
          actions.push(`${label}${ok}`)
          totalActions[label] = (totalActions[label] || 0) + ok
        }
      }
    }
    // Steal
    if (status.stealable.length > 0) {
      let ok = 0
      const stolenPlants: string[] = []
      for (let i = 0; i < status.stealable.length; i++) {
        try {
          await this.stealHarvest(friend.gid, [status.stealable[i]])
          ok++
          if (status.stealableInfo[i]) stolenPlants.push(status.stealableInfo[i].name)
        } catch {}
        await sleep(100)
      }
      if (ok > 0) {
        const plantNames = [...new Set(stolenPlants)].join('/')
        actions.push(`偷${ok}${plantNames ? `(${plantNames})` : ''}`)
        totalActions.steal = (totalActions.steal || 0) + ok
      }
    }
    if (actions.length > 0) {
      log('好友', `${friend.name}: ${actions.join('/')}`)
      this.store.updateFriendActions(friend.gid, actions)
    }
    await this.leaveFriendFarm(friend.gid)
  }

  async checkFriends(): Promise<void> {
    if (this.isChecking || !this.conn.userState.gid) return
    this.isChecking = true
    this.checkDailyReset()
    try {
      const friendsReply = await this.getAllFriends()
      const friends = (friendsReply as any).game_friends || []
      if (!friends.length) {
        log('好友', '没有好友')
        return
      }
      const state = this.conn.userState
      const canHelpWithExp =
        !HELP_ONLY_WITH_EXP || this.canGetExp(10005) || this.canGetExp(10006) || this.canGetExp(10007)
      const friendsToVisit: { gid: number; name: string }[] = []
      const visitedGids = new Set<number>()
      for (const f of friends) {
        const gid = toNum(f.gid)
        if (gid === state.gid || visitedGids.has(gid)) continue
        const name = f.remark || f.name || `GID:${gid}`
        const p = f.plant
        const hasSteal = p ? toNum(p.steal_plant_num) > 0 : false
        const hasHelp = p ? toNum(p.dry_num) > 0 || toNum(p.weed_num) > 0 || toNum(p.insect_num) > 0 : false
        if (hasSteal || (hasHelp && canHelpWithExp)) {
          friendsToVisit.push({ gid, name })
          visitedGids.add(gid)
        }
      }
      // Write full friend list to store for UI (preserve existing actions)
      const existingActions = new Map(this.store.state.friendList.map((f) => [f.gid, f.actions]))
      this.store.updateFriendList(
        friends.map((f: any) => {
          const gid = toNum(f.gid)
          return {
            gid,
            name: f.remark || f.name || `GID:${gid}`,
            level: toNum(f.level),
            actions: existingActions.get(gid) || [],
          }
        }),
        friends.length,
      )

      if (!friendsToVisit.length) return
      this.store.updateFriendPatrol(0, friendsToVisit.length)
      const totalActions: Record<string, number> = {}
      for (let i = 0; i < friendsToVisit.length; i++) {
        try {
          await this.visitFriend(friendsToVisit[i], totalActions)
        } catch {}
        this.store.updateFriendPatrol(i + 1, friendsToVisit.length)
        await sleep(500)
      }
      const summary: string[] = []
      if (totalActions.steal) summary.push(`偷${totalActions.steal}`)
      if (totalActions.草) summary.push(`除草${totalActions.草}`)
      if (totalActions.虫) summary.push(`除虫${totalActions.虫}`)
      if (totalActions.水) summary.push(`浇水${totalActions.水}`)
      if (summary.length > 0) log('好友', `巡查 ${friendsToVisit.length} 人 → ${summary.join('/')}`)
      this.store.addFriendStats({
        steal: totalActions.steal || 0,
        weed: totalActions.草 || 0,
        bug: totalActions.虫 || 0,
        water: totalActions.水 || 0,
      })
    } catch (err: any) {
      logWarn('好友', `巡查失败: ${err.message}`)
    } finally {
      this.isChecking = false
    }
  }

  private async getApplications(): Promise<any> {
    const body = types.GetApplicationsRequest.encode(types.GetApplicationsRequest.create({})).finish()
    const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.friendpb.FriendService', 'GetApplications', body)
    return types.GetApplicationsReply.decode(replyBody)
  }

  private async acceptFriends(gids: number[]): Promise<any> {
    const body = types.AcceptFriendsRequest.encode(
      types.AcceptFriendsRequest.create({ friend_gids: gids.map((g) => toLong(g)) }),
    ).finish()
    const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.friendpb.FriendService', 'AcceptFriends', body)
    return types.AcceptFriendsReply.decode(replyBody)
  }

  private onFriendApplicationReceived = (applications: any[]): void => {
    const names = applications.map((a: any) => a.name || `GID:${toNum(a.gid)}`).join(', ')
    log('申请', `收到 ${applications.length} 个好友申请: ${names}`)
    const gids = applications.map((a: any) => toNum(a.gid))
    this.acceptFriendsWithRetry(gids)
  }

  private async checkAndAcceptApplications(): Promise<void> {
    try {
      const reply = (await this.getApplications()) as any
      const applications = reply.applications || []
      if (!applications.length) return
      const names = applications.map((a: any) => a.name || `GID:${toNum(a.gid)}`).join(', ')
      log('申请', `发现 ${applications.length} 个待处理申请: ${names}`)
      await this.acceptFriendsWithRetry(applications.map((a: any) => toNum(a.gid)))
    } catch {}
  }

  private async acceptFriendsWithRetry(gids: number[]): Promise<void> {
    if (!gids.length) return
    try {
      const reply = (await this.acceptFriends(gids)) as any
      const friends = reply.friends || []
      if (friends.length > 0) {
        const names = friends.map((f: any) => f.name || f.remark || `GID:${toNum(f.gid)}`).join(', ')
        log('申请', `已同意 ${friends.length} 人: ${names}`)
      }
    } catch (e: any) {
      logWarn('申请', `同意失败: ${e.message}`)
    }
  }

  start(): void {
    if (this.loopRunning) return
    this.loopRunning = true
    this.farm.setOperationLimitsCallback((limits) => this.updateOperationLimits(limits))
    this.conn.on('friendApplicationReceived', this.onFriendApplicationReceived)
    this.loopTimer = setTimeout(() => this.loop(), 5000)
    this.acceptTimer = setTimeout(() => {
      this.acceptTimer = null
      this.checkAndAcceptApplications()
    }, 3000)
  }

  private async loop(): Promise<void> {
    while (this.loopRunning) {
      await this.checkFriends()
      if (!this.loopRunning) break
      await sleep(config.friendCheckInterval)
    }
  }

  stop(): void {
    this.loopRunning = false
    this.conn.off('friendApplicationReceived', this.onFriendApplicationReceived)
    if (this.loopTimer) {
      clearTimeout(this.loopTimer)
      this.loopTimer = null
    }
    if (this.acceptTimer) {
      clearTimeout(this.acceptTimer)
      this.acceptTimer = null
    }
  }
}
