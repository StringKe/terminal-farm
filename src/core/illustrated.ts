import { getItemName } from '../config/game-data.js'
import type { Connection } from '../protocol/connection.js'
import { types } from '../protocol/proto-loader.js'
import type { ScopedLogger } from '../utils/logger.js'
import { toNum } from '../utils/long.js'
import type { TaskScheduler } from './scheduler.js'

export class IllustratedManager {
  constructor(
    private conn: Connection,
    private logger: ScopedLogger,
    private scheduler: TaskScheduler,
  ) {}

  async checkAndClaimRewards(): Promise<void> {
    try {
      const body = types.GetIllustratedLevelListV2Request.encode(
        types.GetIllustratedLevelListV2Request.create({ type: 1 }),
      ).finish()
      const { body: replyBody } = await this.conn.sendMsgAsync(
        'gamepb.illustratedpb.IllustratedService',
        'GetIllustratedLevelListV2',
        body,
      )
      const reply = types.GetIllustratedLevelListV2Reply.decode(replyBody) as any
      const levelList = reply.level_list || []

      const claimable = levelList.filter((l: any) => l.can_claim && !l.claimed)
      if (!claimable.length) return

      this.logger.log('图鉴', `发现 ${claimable.length} 个可领取的图鉴等级奖励`)
      await this.claimAll()
    } catch (e: any) {
      this.logger.logWarn('图鉴', `检查图鉴奖励失败: ${e.message}`)
    }
  }

  private async claimAll(): Promise<void> {
    try {
      const body = types.ClaimAllRewardsV2Request.encode(types.ClaimAllRewardsV2Request.create({ type: 1 })).finish()
      const { body: replyBody } = await this.conn.sendMsgAsync(
        'gamepb.illustratedpb.IllustratedService',
        'ClaimAllRewardsV2',
        body,
      )
      const reply = types.ClaimAllRewardsV2Reply.decode(replyBody) as any
      const rewards = reply.total_rewards || []
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
        this.logger.log('图鉴', `领取奖励: ${summary}`)
      }
    } catch (e: any) {
      this.logger.logWarn('图鉴', `领取图鉴奖励失败: ${e.message}`)
    }
  }

  private onRewardRedDot = (): void => {
    this.logger.log('图鉴', '收到红点推送，检查可领取奖励...')
    this.scheduler.trigger('illustrated-check', 500)
  }

  registerTasks(): void {
    // 长间隔周期任务，主要靠推送 trigger 触发
    this.scheduler.every('illustrated-check', () => this.checkAndClaimRewards(), {
      intervalMs: 3600_000,
      startDelayMs: 6000,
      name: '图鉴奖励',
    })
    this.conn.on('illustratedRewardRedDot', this.onRewardRedDot)
  }
}
