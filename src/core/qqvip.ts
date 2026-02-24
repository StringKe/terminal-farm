import { getItemName } from '../config/game-data.js'
import type { Connection } from '../protocol/connection.js'
import { types } from '../protocol/proto-loader.js'
import type { ScopedLogger } from '../utils/logger.js'
import { toNum } from '../utils/long.js'
import type { TaskScheduler } from './scheduler.js'

export class QQVipManager {
  constructor(
    private conn: Connection,
    private logger: ScopedLogger,
    private scheduler: TaskScheduler,
  ) {}

  async checkAndClaim(): Promise<void> {
    try {
      const body = types.GetDailyGiftStatusRequest.encode(types.GetDailyGiftStatusRequest.create({})).finish()
      const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.userpb.UserService', 'GetDailyGiftStatus', body)
      const reply = types.GetDailyGiftStatusReply.decode(replyBody) as any

      if (!reply.is_qq_vip) return
      if (reply.claimed_today) return
      if (!reply.can_claim) return

      this.logger.log('会员', 'QQ会员每日礼包可领取，正在领取...')
      await this.claimGift()
    } catch (e: any) {
      this.logger.logWarn('会员', `检查会员礼包失败: ${e.message}`)
    }
  }

  private async claimGift(): Promise<void> {
    try {
      const body = types.ClaimDailyGiftRequest.encode(types.ClaimDailyGiftRequest.create({})).finish()
      const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.userpb.UserService', 'ClaimDailyGift', body)
      const reply = types.ClaimDailyGiftReply.decode(replyBody) as any
      const rewards = reply.rewards || []
      if (rewards.length > 0) {
        const summary = rewards
          .map((r: any) => {
            const id = toNum(r.id)
            const count = toNum(r.count)
            if (id === 1) return `金币${count}`
            if (id === 2) return `经验${count}`
            return `${getItemName(id)}(${id})x${count}`
          })
          .join('/')
        this.logger.log('会员', `领取每日礼包: ${summary}`)
      } else {
        this.logger.log('会员', '已领取每日礼包')
      }
    } catch (e: any) {
      this.logger.logWarn('会员', `领取会员礼包失败: ${e.message}`)
    }
  }

  private onGiftStatusChanged = (): void => {
    this.logger.log('会员', '收到礼包状态推送，检查可领取...')
    this.scheduler.trigger('qqvip-check', 500)
  }

  registerTasks(): void {
    this.scheduler.every('qqvip-check', () => this.checkAndClaim(), {
      intervalMs: 3600_000,
      startDelayMs: 5000,
      name: 'QQ会员礼包',
    })
    this.conn.on('dailyGiftStatusChanged', this.onGiftStatusChanged)
  }
}
