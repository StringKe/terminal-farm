import { getItemName } from '../config/game-data.js'
import type { Connection } from '../protocol/connection.js'
import { types } from '../protocol/proto-loader.js'
import { log, logWarn, sleep } from '../utils/logger.js'
import { toLong, toNum } from '../utils/long.js'

export class TaskManager {
  constructor(private conn: Connection) {}

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
      const claimable = this.analyzeTaskList(allTasks)
      if (!claimable.length) return
      log('任务', `发现 ${claimable.length} 个可领取任务`)
      await this.claimTasksFromList(claimable)
    } catch {}
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

  private onTaskInfoNotify = (taskInfo: any): void => {
    if (!taskInfo) return
    const allTasks = [...(taskInfo.growth_tasks || []), ...(taskInfo.daily_tasks || []), ...(taskInfo.tasks || [])]
    const claimable = this.analyzeTaskList(allTasks)
    if (!claimable.length) return
    log('任务', `有 ${claimable.length} 个任务可领取，准备自动领取...`)
    setTimeout(() => this.claimTasksFromList(claimable), 1000)
  }

  start(): void {
    this.conn.on('taskInfoNotify', this.onTaskInfoNotify)
    setTimeout(() => this.checkAndClaimTasks(), 4000)
  }

  stop(): void {
    this.conn.off('taskInfoNotify', this.onTaskInfoNotify)
  }
}
