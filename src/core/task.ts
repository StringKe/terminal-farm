import { getItemName } from '../config/game-data.js'
import type { Connection } from '../protocol/connection.js'
import { types } from '../protocol/proto-loader.js'
import type { SessionStore } from '../store/session-store.js'
import { log, logWarn, sleep } from '../utils/logger.js'
import { toLong, toNum } from '../utils/long.js'

export class TaskManager {
  private initTimer: ReturnType<typeof setTimeout> | null = null
  private claimTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private conn: Connection,
    private store: SessionStore,
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

  async checkAndClaimTasks(): Promise<void> {
    try {
      const reply = (await this.getTaskInfo()) as any
      if (!reply.task_info) return
      const taskInfo = reply.task_info
      const allTasks = [...(taskInfo.growth_tasks || []), ...(taskInfo.daily_tasks || []), ...(taskInfo.tasks || [])]
      this.syncTaskList(allTasks)
      const claimable = this.analyzeTaskList(allTasks)
      if (!claimable.length) return
      log('任务', `发现 ${claimable.length} 个可领取任务`)
      await this.claimTasksFromList(claimable)
    } catch (e: any) {
      logWarn('任务', `检查任务失败: ${e.message}`)
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
        log('任务', `领取: ${task.desc}${multipleStr} → ${rewardStr}`)
        await sleep(300)
      } catch (e: any) {
        logWarn('任务', `领取失败 #${task.id}: ${e.message}`)
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
    if (!claimable.length) return
    log('任务', `有 ${claimable.length} 个任务可领取，准备自动领取...`)
    this.claimTimer = setTimeout(() => {
      this.claimTimer = null
      this.claimTasksFromList(claimable)
    }, 1000)
  }

  start(): void {
    this.conn.on('taskInfoNotify', this.onTaskInfoNotify)
    this.initTimer = setTimeout(() => {
      this.initTimer = null
      this.checkAndClaimTasks()
    }, 4000)
  }

  stop(): void {
    this.conn.off('taskInfoNotify', this.onTaskInfoNotify)
    if (this.initTimer) {
      clearTimeout(this.initTimer)
      this.initTimer = null
    }
    if (this.claimTimer) {
      clearTimeout(this.claimTimer)
      this.claimTimer = null
    }
  }
}
