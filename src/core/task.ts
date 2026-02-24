import { getItemName } from '../config/game-data.js'
import type { Connection } from '../protocol/connection.js'
import { types } from '../protocol/proto-loader.js'
import type { SessionStore } from '../store/session-store.js'
import type { ScopedLogger } from '../utils/logger.js'
import { toLong, toNum } from '../utils/long.js'
import { jitteredSleep } from '../utils/random.js'
import type { TaskScheduler } from './scheduler.js'

export class TaskManager {
  constructor(
    private conn: Connection,
    private store: SessionStore,
    private logger: ScopedLogger,
    private scheduler: TaskScheduler,
  ) {}

  async getTaskInfo(): Promise<any> {
    const body = types.TaskInfoRequest.encode(types.TaskInfoRequest.create({})).finish()
    const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.taskpb.TaskService', 'TaskInfo', body)
    return types.TaskInfoReply.decode(replyBody)
  }

  async claimTaskReward(taskId: number, doShared = false): Promise<any> {
    const body = types.ClaimTaskRewardRequest.encode(
      types.ClaimTaskRewardRequest.create({ id: toLong(taskId), do_shared: doShared }),
    ).finish()
    const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.taskpb.TaskService', 'ClaimTaskReward', body)
    return types.ClaimTaskRewardReply.decode(replyBody)
  }

  private analyzeTaskList(tasks: any[]): any[] {
    const claimable: any[] = []
    for (const task of tasks) {
      const id = toNum(task.id)
      const progress = toNum(task.progress)
      const totalProgress = toNum(task.total_progress)
      if (task.is_unlocked && !task.is_claimed && progress >= totalProgress && totalProgress > 0) {
        claimable.push({
          id,
          desc: task.desc || `任务#${id}`,
          shareMultiple: toNum(task.share_multiple),
          rewards: task.rewards || [],
        })
      }
    }
    return claimable
  }

  private getRewardSummary(items: any[]): string {
    const summary: string[] = []
    for (const item of items) {
      const id = toNum(item.id)
      const count = toNum(item.count)
      if (id === 1) summary.push(`金币${count}`)
      else if (id === 2) summary.push(`经验${count}`)
      else summary.push(`${getItemName(id)}(${id})x${count}`)
    }
    return summary.join('/')
  }

  async claimDailyReward(type: number, pointIds: number[]): Promise<any> {
    const body = types.ClaimDailyRewardRequest.encode(
      types.ClaimDailyRewardRequest.create({
        type,
        point_ids: pointIds.map((id) => toLong(id)),
      }),
    ).finish()
    const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.taskpb.TaskService', 'ClaimDailyReward', body)
    return types.ClaimDailyRewardReply.decode(replyBody)
  }

  async checkAndClaimTasks(): Promise<void> {
    try {
      const reply = (await this.getTaskInfo()) as any
      if (!reply.task_info) return
      const taskInfo = reply.task_info
      const allTasks = [...(taskInfo.growth_tasks || []), ...(taskInfo.daily_tasks || []), ...(taskInfo.tasks || [])]
      this.syncTaskList(allTasks)
      const claimable = this.analyzeTaskList(allTasks)
      if (claimable.length) {
        this.logger.log('任务', `发现 ${claimable.length} 个可领取任务`)
        await this.claimTasksFromList(claimable)
      }
      // 检查活跃度奖励
      await this.checkAndClaimActives(taskInfo.actives || [])
    } catch (e: any) {
      this.logger.logWarn('任务', `检查任务失败: ${e.message}`)
    }
  }

  private async checkAndClaimActives(actives: any[]): Promise<void> {
    for (const active of actives) {
      const activeType = toNum(active.type)
      const rewards = active.rewards || []
      // status === 2 (DONE) 表示已达标可领取
      const claimable = rewards.filter((r: any) => toNum(r.status) === 2)
      if (!claimable.length) continue
      const pointIds = claimable.map((r: any) => toNum(r.point_id))
      const typeName = activeType === 1 ? '日活跃' : activeType === 2 ? '周活跃' : `活跃${activeType}`
      this.logger.log('活跃', `${typeName} 发现 ${claimable.length} 个可领取奖励`)
      try {
        const reply = (await this.claimDailyReward(activeType, pointIds)) as any
        const items = reply.items || []
        if (items.length > 0) {
          const rewardStr = this.getRewardSummary(items)
          this.logger.log('活跃', `${typeName} 领取: ${rewardStr}`)
        }
      } catch (e: any) {
        this.logger.logWarn('活跃', `${typeName} 领取失败: ${e.message}`)
      }
    }
  }

  private async claimTasksFromList(claimable: any[]): Promise<void> {
    for (const task of claimable) {
      try {
        const useShare = task.shareMultiple > 1
        const multipleStr = useShare ? ` (${task.shareMultiple}倍)` : ''
        const claimReply = (await this.claimTaskReward(task.id, useShare)) as any
        const items = claimReply.items || []
        const rewardStr = items.length > 0 ? this.getRewardSummary(items) : '无'
        this.logger.log('任务', `领取: ${task.desc}${multipleStr} → ${rewardStr}`)
        await jitteredSleep(300, this.scheduler.jitterRatio)
      } catch (e: any) {
        this.logger.logWarn('任务', `领取失败 #${task.id}: ${e.message}`)
      }
    }
  }

  private syncTaskList(allTasks: any[]): void {
    this.store.updateTaskList(
      allTasks.map((t) => ({
        id: toNum(t.id),
        desc: t.desc || `任务#${toNum(t.id)}`,
        progress: toNum(t.progress),
        totalProgress: toNum(t.total_progress),
        isUnlocked: !!t.is_unlocked,
        isClaimed: !!t.is_claimed,
      })),
    )
  }

  private onTaskInfoNotify = (taskInfo: any): void => {
    if (!taskInfo) return
    const allTasks = [...(taskInfo.growth_tasks || []), ...(taskInfo.daily_tasks || []), ...(taskInfo.tasks || [])]
    this.syncTaskList(allTasks)
    const claimable = this.analyzeTaskList(allTasks)
    const hasClaimable = claimable.length > 0
    const actives = taskInfo.actives || []

    if (!hasClaimable && !actives.length) return
    if (hasClaimable) this.logger.log('任务', `有 ${claimable.length} 个任务可领取，准备自动领取...`)

    this.scheduler.trigger('task-claim', 1000)
  }

  registerTasks(): void {
    this.scheduler.once('task-init', () => this.checkAndClaimTasks(), {
      delayMs: 4000,
      name: '任务初始化',
    })
    // task-claim 用于推送触发的领取（trigger 提前调度）
    this.scheduler.every('task-claim', () => this.checkAndClaimTasks(), {
      intervalMs: 300_000,
      startDelayMs: 300_000,
      name: '任务领取',
    })
    this.conn.on('taskInfoNotify', this.onTaskInfoNotify)
  }

  unregisterListeners(): void {
    this.conn.off('taskInfoNotify', this.onTaskInfoNotify)
  }
}
