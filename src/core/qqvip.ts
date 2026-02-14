import { getItemName } from '../config/game-data.js'
import type { Connection } from '../protocol/connection.js'
import { types } from '../protocol/proto-loader.js'
import { log, logWarn } from '../utils/logger.js'
import { toNum } from '../utils/long.js'

export class QQVipManager {
  private initTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private conn: Connection) {}

  async checkAndClaim(): Promise<void> {
    try {
      const body = types.GetDailyGiftStatusRequest.encode(types.GetDailyGiftStatusRequest.create({})).finish()
      const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.userpb.UserService', 'GetDailyGiftStatus', body)
      const reply = types.GetDailyGiftStatusReply.decode(replyBody) as any

      if (!reply.is_qq_vip) return
      if (reply.claimed_today) return
      if (!reply.can_claim) return

      log('会员', 'QQ会员每日礼包可领取，正在领取...')
      await this.claimGift()
    } catch (e: any) {
      logWarn('会员', `检查会员礼包失败: ${e.message}`)
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
        log('会员', `领取每日礼包: ${summary}`)
      } else {
        log('会员', '已领取每日礼包')
      }
    } catch (e: any) {
      logWarn('会员', `领取会员礼包失败: ${e.message}`)
    }
  }

  private onGiftStatusChanged = (): void => {
    log('会员', '收到礼包状态推送，检查可领取...')
    setTimeout(() => this.checkAndClaim(), 500)
  }

  start(): void {
    this.conn.on('dailyGiftStatusChanged', this.onGiftStatusChanged)
    this.initTimer = setTimeout(() => {
      this.initTimer = null
      this.checkAndClaim()
    }, 5000)
  }

  stop(): void {
    this.conn.off('dailyGiftStatusChanged', this.onGiftStatusChanged)
    if (this.initTimer) {
      clearTimeout(this.initTimer)
      this.initTimer = null
    }
  }
}
