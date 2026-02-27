import type { Connection } from '../protocol/connection.js'
import { types } from '../protocol/proto-loader.js'
import type { ScopedLogger } from '../utils/logger.js'
import { toLong, toNum } from '../utils/long.js'
import { formatRewards } from '../utils/reward.js'
import type { TaskScheduler } from './scheduler.js'

export class MallManager {
  constructor(
    private conn: Connection,
    private logger: ScopedLogger,
    private scheduler: TaskScheduler,
  ) {}

  // ============ 商城免费礼包 ============

  async checkFreeGifts(): Promise<void> {
    try {
      const profileBody = types.GetMallProfilesRequest.encode(types.GetMallProfilesRequest.create({})).finish()
      const { body: profileReplyBody } = await this.conn.sendMsgAsync(
        'gamepb.mallpb.MallService',
        'GetMallProfiles',
        profileBody,
      )
      const profileReply = types.GetMallProfilesReply.decode(profileReplyBody) as any
      const profiles = profileReply.mall_profiles || []

      let totalClaimed = 0
      for (const profile of profiles) {
        const slotType = profile.mall_type ?? toNum(profile.id)
        try {
          const claimed = await this.claimFreeInSlot(slotType)
          totalClaimed += claimed
        } catch (e: any) {
          this.logger.logWarn('商城', `查询分类 ${slotType} 失败: ${e.message}`)
        }
      }
      if (totalClaimed > 0) {
        this.logger.log('商城', `领取 ${totalClaimed} 个免费礼包`)
      }
    } catch (e: any) {
      this.logger.logWarn('商城', `查询商城分类失败: ${e.message}`)
    }
  }

  private async claimFreeInSlot(slotType: number): Promise<number> {
    const body = types.GetMallListBySlotTypeRequest.encode(
      types.GetMallListBySlotTypeRequest.create({ slot_type: slotType }),
    ).finish()
    const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.mallpb.MallService', 'GetMallListBySlotType', body)
    const reply = types.GetMallListBySlotTypeReply.decode(replyBody) as any
    const products = reply.products || []

    let claimed = 0
    for (const product of products) {
      if (!product.is_free) continue
      if (!product.is_available_purchase) continue
      const restriction = product.restriction
      if (restriction) {
        const current = toNum(restriction.current_count)
        const max = toNum(restriction.max_count)
        if (max > 0 && current >= max) continue
      }
      const productId = toNum(product.id)
      const productName = product.name || `商品${productId}`
      try {
        await this.purchase(productId, productName)
        claimed++
      } catch (e: any) {
        this.logger.logWarn('商城', `领取 ${productName} 失败: ${e.message}`)
      }
    }
    return claimed
  }

  private async purchase(productId: number, productName: string): Promise<void> {
    const body = types.PurchaseRequest.encode(
      types.PurchaseRequest.create({ id: toLong(productId), buy_num: toLong(1) }),
    ).finish()
    const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.mallpb.MallService', 'Purchase', body)
    const reply = types.PurchaseReply.decode(replyBody) as any
    const rewards = reply.reward_items || []
    if (rewards.length > 0) {
      this.logger.log('商城', `${productName}: ${formatRewards(rewards)}`)
    } else {
      this.logger.log('商城', `${productName}: 已领取`)
    }
  }

  // ============ 月卡每日奖励 ============

  async checkMonthCard(): Promise<void> {
    try {
      const body = types.GetMonthCardInfosRequest.encode(types.GetMonthCardInfosRequest.create({})).finish()
      const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.mallpb.MallService', 'GetMonthCardInfos', body)
      const reply = types.GetMonthCardInfosReply.decode(replyBody) as any
      const monthCards = reply.month_cards || []

      let claimedCount = 0
      for (const card of monthCards) {
        if (!card.is_active) continue
        if (!card.has_reward_items) continue
        const cardId = toNum(card.id)
        try {
          await this.claimMonthCardReward(cardId)
          claimedCount++
        } catch (e: any) {
          this.logger.logWarn('月卡', `领取月卡 ${cardId} 奖励失败: ${e.message}`)
        }
      }
      if (claimedCount > 0) {
        this.logger.log('月卡', `已领取 ${claimedCount} 张月卡奖励`)
      }
    } catch (e: any) {
      this.logger.logWarn('月卡', `查询月卡信息失败: ${e.message}`)
    }
  }

  private async claimMonthCardReward(cardId: number): Promise<void> {
    const body = types.ClaimMonthCardRewardRequest.encode(
      types.ClaimMonthCardRewardRequest.create({ id: toLong(cardId) }),
    ).finish()
    const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.mallpb.MallService', 'ClaimMonthCardReward', body)
    const reply = types.ClaimMonthCardRewardReply.decode(replyBody) as any
    const rewards = reply.reward_items || []
    if (rewards.length > 0) {
      this.logger.log('月卡', `月卡${cardId} 每日奖励: ${formatRewards(rewards)}`)
    }
  }

  // ============ 每日分享探测 ============

  async checkShare(): Promise<void> {
    try {
      const checkBody = types.CheckCanShareRequest.encode(types.CheckCanShareRequest.create({})).finish()
      const { body: checkReplyBody } = await this.conn.sendMsgAsync(
        'gamepb.sharepb.ShareService',
        'CheckCanShare',
        checkBody,
      )
      const checkReply = types.CheckCanShareReply.decode(checkReplyBody) as any
      if (!checkReply.can_share) {
        this.logger.log('分享', '今日分享不可用')
        return
      }

      const reportBody = types.ReportShareRequest.encode(
        types.ReportShareRequest.create({ share_id: toLong(1), params: [], channel: 1 }),
      ).finish()
      const { body: reportReplyBody } = await this.conn.sendMsgAsync(
        'gamepb.sharepb.ShareService',
        'ReportShare',
        reportBody,
      )
      const reportReply = types.ReportShareReply.decode(reportReplyBody) as any
      const shareInfos = reportReply.share_infos || {}

      const info = shareInfos[1] || shareInfos['1']
      if (!info) {
        this.logger.log('分享', '分享上报成功，无返回信息')
        return
      }

      const shareCount = toNum(info.share_count)
      if (shareCount > 0 && !info.is_claimed) {
        await this.claimShareReward()
      } else if (info.is_claimed) {
        this.logger.log('分享', '今日分享奖励已领取')
      } else {
        this.logger.log('分享', '分享探测完成，无可领奖励')
      }
    } catch (e: any) {
      this.logger.logWarn('分享', `分享探测失败: ${e.message}`)
    }
  }

  private async claimShareReward(): Promise<void> {
    try {
      const body = types.ClaimShareRewardRequest.encode(
        types.ClaimShareRewardRequest.create({ share_id: toLong(1) }),
      ).finish()
      const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.sharepb.ShareService', 'ClaimShareReward', body)
      const reply = types.ClaimShareRewardReply.decode(replyBody) as any
      const rewards = reply.rewards || []
      if (rewards.length > 0) {
        this.logger.log('分享', `领取分享奖励: ${formatRewards(rewards)}`)
      } else {
        this.logger.log('分享', '已领取分享奖励')
      }
    } catch (e: any) {
      this.logger.logWarn('分享', `领取分享奖励失败: ${e.message}`)
    }
  }

  registerTasks(): void {
    this.scheduler.every('mall-free', () => this.checkFreeGifts(), {
      intervalMs: 3600_000,
      startDelayMs: 9000,
      name: '商城免费礼包',
    })
    this.scheduler.every('monthcard-check', () => this.checkMonthCard(), {
      intervalMs: 3600_000,
      startDelayMs: 9500,
      name: '月卡奖励',
    })
    this.scheduler.once('share-check', () => this.checkShare(), {
      delayMs: 10_000,
      name: '分享探测',
    })
  }
}
