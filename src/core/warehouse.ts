import { FERTILIZER_REFILL_ITEMS, GOLD_ITEM_ID } from '../config/constants.js'
import { getAllFruitIds, getAutoUsableItemIds, getFruitName, getItemName } from '../config/game-data.js'
import type { AccountConfig } from '../config/schema.js'
import type { Connection } from '../protocol/connection.js'
import { types } from '../protocol/proto-loader.js'
import type { SessionStore } from '../store/session-store.js'
import type { ScopedLogger } from '../utils/logger.js'
import { emitRuntimeHint } from '../utils/logger.js'
import { toLong, toNum } from '../utils/long.js'
import { jitteredSleep } from '../utils/random.js'
import type { TaskScheduler } from './scheduler.js'

let FRUIT_ID_SET: Set<number> | null = null

function loadFruitIds(): Set<number> {
  if (FRUIT_ID_SET) return FRUIT_ID_SET
  FRUIT_ID_SET = getAllFruitIds()
  return FRUIT_ID_SET
}

const NORMAL_FERT_IDS = new Set(FERTILIZER_REFILL_ITEMS[1011])
const ORGANIC_FERT_IDS = new Set(FERTILIZER_REFILL_ITEMS[1012])

export class WarehouseManager {
  constructor(
    private conn: Connection,
    private store: SessionStore,
    private getAccountConfig: () => AccountConfig,
    private logger: ScopedLogger,
    private scheduler: TaskScheduler,
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
      if (toSell.length) {
        const reply = await this.sellItems(toSell)
        const totalGold = this.extractGold(reply)
        this.logger.log('仓库', `出售 ${names.join(', ')}，获得 ${totalGold} 金币`)
        emitRuntimeHint(false)
      }

      // 自动使用背包物品（礼包/化肥）
      await this.autoUseItems(items)
    } catch (e: any) {
      this.logger.logWarn('仓库', `出售失败: ${e.message}`)
    }
  }

  private shouldAutoUse(id: number): boolean {
    const cfg = this.getAccountConfig()
    if (NORMAL_FERT_IDS.has(id)) return cfg.autoRefillNormalFertilizer
    if (ORGANIC_FERT_IDS.has(id)) return cfg.autoRefillOrganicFertilizer
    return cfg.autoUseGiftPacks
  }

  private async refreshBag(): Promise<void> {
    const freshBag = await this.getBag()
    this.store.updateBag(this.getBagItems(freshBag))
  }

  private async autoUseItems(items: any[]): Promise<void> {
    const usableIds = getAutoUsableItemIds()
    const jitter = this.scheduler.jitterRatio
    let anyUsed = false
    for (const item of items) {
      const id = toNum(item.id)
      const count = toNum(item.count)
      if ((!usableIds.has(id) && !NORMAL_FERT_IDS.has(id) && !ORGANIC_FERT_IDS.has(id)) || count <= 0) continue
      if (!this.shouldAutoUse(id)) continue
      const name = getItemName(id)
      for (let i = 0; i < count; i++) {
        try {
          const body = types.UseRequest.encode(
            types.UseRequest.create({ item: { id: toLong(id), count: toLong(1) } }),
          ).finish()
          const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.itempb.ItemService', 'Use', body)
          const reply = types.UseReply.decode(replyBody) as any
          anyUsed = true
          if (reply.get_items?.length) {
            const rewards = reply.get_items.map((r: any) => `${getItemName(toNum(r.id))}x${toNum(r.count)}`).join(', ')
            this.logger.log('背包', `使用 ${name} → ${rewards}`)
          } else {
            this.logger.log('背包', `使用 ${name} x1`)
          }
        } catch (e: any) {
          this.logger.logWarn('背包', `使用 ${name} 失败: ${e.message}`)
          break
        }
        await jitteredSleep(300, jitter)
      }
    }
    if (anyUsed) {
      try {
        await this.refreshBag()
      } catch (e: any) {
        this.logger.logWarn('背包', `刷新背包失败: ${e.message}`)
      }
    }
  }

  registerTasks(): void {
    this.scheduler.every('warehouse-sell', () => this.sellAllFruits(), {
      intervalMs: 60_000,
      startDelayMs: 10_000,
      name: '仓库出售',
    })
  }
}
