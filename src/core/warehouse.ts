import { GOLD_ITEM_ID } from '../config/constants.js'
import { getAllFruitIds, getFruitName } from '../config/game-data.js'
import type { Connection } from '../protocol/connection.js'
import { types } from '../protocol/proto-loader.js'
import type { SessionStore } from '../store/session-store.js'
import { log, logWarn } from '../utils/logger.js'
import { emitRuntimeHint } from '../utils/logger.js'
import { toLong, toNum } from '../utils/long.js'

let FRUIT_ID_SET: Set<number> | null = null

function loadFruitIds(): Set<number> {
  if (FRUIT_ID_SET) return FRUIT_ID_SET
  FRUIT_ID_SET = getAllFruitIds()
  return FRUIT_ID_SET
}

export class WarehouseManager {
  private sellTimer: ReturnType<typeof setInterval> | null = null

  constructor(
    private conn: Connection,
    private store: SessionStore,
  ) {
    loadFruitIds()
  }

  async getBag(): Promise<any> {
    const body = types.BagRequest.encode(types.BagRequest.create({})).finish()
    const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.itempb.ItemService', 'Bag', body)
    return types.BagReply.decode(replyBody)
  }

  private getBagItems(bagReply: any): any[] {
    if (bagReply.item_bag?.items?.length) return bagReply.item_bag.items
    return bagReply.items || []
  }

  private toSellItem(item: any): any {
    return {
      id: item.id != null ? toLong(item.id) : undefined,
      count: item.count != null ? toLong(item.count) : undefined,
      uid: item.uid != null ? toLong(item.uid) : undefined,
    }
  }

  async sellItems(items: any[]): Promise<any> {
    const payload = items.map((i) => this.toSellItem(i))
    const body = types.SellRequest.encode(types.SellRequest.create({ items: payload })).finish()
    const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.itempb.ItemService', 'Sell', body)
    return types.SellReply.decode(replyBody)
  }

  private extractGold(sellReply: any): number {
    if (sellReply.get_items?.length > 0) {
      for (const item of sellReply.get_items) {
        if (toNum(item.id) === GOLD_ITEM_ID) return toNum(item.count)
      }
      return 0
    }
    if (sellReply.gold != null) return toNum(sellReply.gold)
    return 0
  }

  async sellAllFruits(): Promise<void> {
    try {
      const bagReply = await this.getBag()
      const items = this.getBagItems(bagReply)
      this.store.updateBag(items)
      const fruits = loadFruitIds()
      const toSell: any[] = []
      const names: string[] = []
      for (const item of items) {
        const id = toNum(item.id)
        const count = toNum(item.count)
        const uid = item.uid ? toNum(item.uid) : 0
        if (fruits.has(id) && count > 0 && uid !== 0) {
          toSell.push(item)
          names.push(`${getFruitName(id)}x${count}`)
        }
      }
      if (!toSell.length) return
      const reply = await this.sellItems(toSell)
      const totalGold = this.extractGold(reply)
      log('仓库', `出售 ${names.join(', ')}，获得 ${totalGold} 金币`)
      emitRuntimeHint(false)
      // 售卖后重新拉取背包，刷新 UI
      try {
        const freshBag = await this.getBag()
        this.store.updateBag(this.getBagItems(freshBag))
      } catch {}
    } catch (e: any) {
      logWarn('仓库', `出售失败: ${e.message}`)
    }
  }

  start(): void {
    if (this.sellTimer) return
    setTimeout(() => {
      this.sellAllFruits()
      this.sellTimer = setInterval(() => this.sellAllFruits(), 60000)
    }, 10000)
  }

  stop(): void {
    if (this.sellTimer) {
      clearInterval(this.sellTimer)
      this.sellTimer = null
    }
  }
}
