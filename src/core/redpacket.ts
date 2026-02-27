import type { Connection } from '../protocol/connection.js'
import { types } from '../protocol/proto-loader.js'
import type { ScopedLogger } from '../utils/logger.js'
import { toNum } from '../utils/long.js'
import { formatRewardName } from '../utils/reward.js'
import type { TaskScheduler } from './scheduler.js'

export class RedPacketManager {
  constructor(
    private conn: Connection,
    private logger: ScopedLogger,
    private scheduler: TaskScheduler,
  ) {}

  async checkAndClaim(): Promise<void> {
    try {
      const body = types.GetTodayClaimStatusRequest.encode(
        types.GetTodayClaimStatusRequest.create({ activity_ids: [] }),
      ).finish()
      const { body: replyBody } = await this.conn.sendMsgAsync(
        'gamepb.redpacketpb.RedPacketService',
        'GetTodayClaimStatus',
        body,
      )
      const reply = types.GetTodayClaimStatusReply.decode(replyBody) as any
      const activities = reply.activities || []

      let claimedCount = 0
      for (const act of activities) {
        const status = act.status
        if (status !== 1) continue
        if (act.claimed_today) continue
        const actId = toNum(act.activity_id)
        const actName = act.act_name || `活动${actId}`
        try {
          await this.claimRedPacket(actId, actName)
          claimedCount++
        } catch (e: any) {
          this.logger.logWarn('红包', `领取 ${actName} 失败: ${e.message}`)
        }
      }
      if (claimedCount > 0) {
        this.logger.log('红包', `今日已领取 ${claimedCount} 个红包`)
      }
    } catch (e: any) {
      this.logger.logWarn('红包', `查询红包状态失败: ${e.message}`)
    }
  }

  private async claimRedPacket(activityId: number, actName: string): Promise<void> {
    const body = types.ClaimRedPacketRequest.encode(
      types.ClaimRedPacketRequest.create({ activity_id: activityId }),
    ).finish()
    const { body: replyBody } = await this.conn.sendMsgAsync(
      'gamepb.redpacketpb.RedPacketService',
      'ClaimRedPacket',
      body,
    )
    const reply = types.ClaimRedPacketReply.decode(replyBody) as any
    if (reply.item) {
      const id = toNum(reply.item.id)
      const count = toNum(reply.item.count)
      this.logger.log('红包', `${actName}: ${formatRewardName(id)} x${count}`)
    } else {
      this.logger.log('红包', `${actName}: 已领取`)
    }
  }

  private onRedPacketStatusNotify = (activities: any[]): void => {
    const claimable = activities.filter((a: any) => a.status === 1 && !a.claimed_today)
    if (claimable.length > 0) {
      this.logger.log('红包', `收到红包推送，${claimable.length} 个可领取`)
      this.scheduler.trigger('redpacket-check', 500)
    }
  }

  registerTasks(): void {
    this.scheduler.every('redpacket-check', () => this.checkAndClaim(), {
      intervalMs: 3600_000,
      startDelayMs: 6000,
      name: '红包领取',
    })
    this.conn.on('redpacketStatusNotify', this.onRedPacketStatusNotify)
  }
}
