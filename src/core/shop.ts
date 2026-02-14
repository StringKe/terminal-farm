import { getItemName } from '../config/game-data.js'
import type { AccountConfig } from '../config/schema.js'
import type { Connection } from '../protocol/connection.js'
import { types } from '../protocol/proto-loader.js'
import { log, logWarn, setCurrentAccountLabel } from '../utils/logger.js'
import { toLong, toNum } from '../utils/long.js'

export class ShopManager {
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(
    private conn: Connection,
    private getAccountConfig: () => AccountConfig,
  ) {}

  start(): void {
    if (this.timer) return
    setTimeout(() => this.checkFreeGifts(), 8000)
    this.timer = setInterval(() => this.checkFreeGifts(), 60 * 60 * 1000)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private async checkFreeGifts(): Promise<void> {
    if (!this.getAccountConfig().autoClaimFreeGifts) return
    if (!this.conn.userState.gid) return
    setCurrentAccountLabel(this.conn.userState.name || `GID:${this.conn.userState.gid}`)

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
                log('礼包', `免费礼包: ${getItemName(toNum(got.id))} x${toNum(got.count)}`)
              } else {
                log('礼包', `免费礼包: ${getItemName(itemId)} 已领取`)
              }
            } catch (e: any) {
              logWarn('礼包', `领取失败 (${getItemName(itemId)}): ${e.message}`)
            }
          }
        } catch {}
      }
    } catch (e: any) {
      logWarn('礼包', `检查免费礼包失败: ${e.message}`)
    }
  }
}
