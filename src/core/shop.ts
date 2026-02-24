import { getItemName } from '../config/game-data.js'
import type { AccountConfig } from '../config/schema.js'
import type { Connection } from '../protocol/connection.js'
import { types } from '../protocol/proto-loader.js'
import type { ScopedLogger } from '../utils/logger.js'
import { toLong, toNum } from '../utils/long.js'
import type { TaskScheduler } from './scheduler.js'

export class ShopManager {
  constructor(
    private conn: Connection,
    private getAccountConfig: () => AccountConfig,
    private logger: ScopedLogger,
    private scheduler: TaskScheduler,
  ) {}

  registerTasks(): void {
    this.scheduler.every('shop-gift', () => this.checkFreeGifts(), {
      intervalMs: 3600_000,
      startDelayMs: 8000,
      name: '免费礼包',
    })
  }

  private async checkFreeGifts(): Promise<void> {
    if (!this.getAccountConfig().autoClaimFreeGifts) return
    if (!this.conn.userState.gid) return

    try {
      const profilesBody = types.ShopProfilesRequest.encode(types.ShopProfilesRequest.create({})).finish()
      const { body: profilesReplyBody } = await this.conn.sendMsgAsync(
        'gamepb.shoppb.ShopService',
        'ShopProfiles',
        profilesBody,
      )
      const profilesReply = types.ShopProfilesReply.decode(profilesReplyBody) as any
      const shops = profilesReply.shops || []

      for (const shop of shops) {
        const shopId = toNum(shop.id)
        if (shopId <= 0) continue
        try {
          const infoBody = types.ShopInfoRequest.encode(
            types.ShopInfoRequest.create({ shop_id: toLong(shopId) }),
          ).finish()
          const { body: infoReplyBody } = await this.conn.sendMsgAsync(
            'gamepb.shoppb.ShopService',
            'ShopInfo',
            infoBody,
          )
          const infoReply = types.ShopInfoReply.decode(infoReplyBody) as any
          const goodsList = infoReply.goods_list || []

          for (const goods of goodsList) {
            const price = toNum(goods.price)
            if (price !== 0) continue
            if (!goods.unlocked) continue
            const limitCount = toNum(goods.limit_count)
            const boughtNum = toNum(goods.bought_num)
            if (limitCount > 0 && boughtNum >= limitCount) continue

            const goodsId = toNum(goods.id)
            const itemId = toNum(goods.item_id)
            try {
              const buyBody = types.BuyGoodsRequest.encode(
                types.BuyGoodsRequest.create({
                  goods_id: toLong(goodsId),
                  num: toLong(1),
                  price: toLong(0),
                }),
              ).finish()
              const { body: buyReplyBody } = await this.conn.sendMsgAsync(
                'gamepb.shoppb.ShopService',
                'BuyGoods',
                buyBody,
              )
              const buyReply = types.BuyGoodsReply.decode(buyReplyBody) as any
              const getItems = buyReply.get_items || []
              if (getItems.length > 0) {
                const got = getItems[0]
                this.logger.log('礼包', `免费礼包: ${getItemName(toNum(got.id))} x${toNum(got.count)}`)
              } else {
                this.logger.log('礼包', `免费礼包: ${getItemName(itemId)} 已领取`)
              }
            } catch (e: any) {
              this.logger.logWarn('礼包', `领取失败 (${getItemName(itemId)}): ${e.message}`)
            }
          }
        } catch {}
      }
    } catch (e: any) {
      this.logger.logWarn('礼包', `检查免费礼包失败: ${e.message}`)
    }
  }
}
