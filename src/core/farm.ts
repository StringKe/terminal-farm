import { Writer } from 'protobufjs'
import { getPlantingRecommendation } from '../../tools/calc-exp-yield.js'
import {
  formatGrowTime,
  getItemName,
  getPlantExp,
  getPlantGrowTime,
  getPlantName,
  getPlantNameBySeedId,
  getSeedIdByPlantId,
} from '../config/game-data.js'
import { NORMAL_FERTILIZER_ID, PlantPhase, SEED_SHOP_ID, config } from '../config/index.js'
import type { Connection } from '../protocol/connection.js'
import { types } from '../protocol/proto-loader.js'
import type { SessionStore } from '../store/session-store.js'
import { log, logWarn, sleep } from '../utils/logger.js'
import { toLong, toNum } from '../utils/long.js'
import { getServerTimeSec, toTimeSec } from '../utils/time.js'

export type OperationLimitsCallback = (limits: any[]) => void

export class FarmManager {
  private isChecking = false
  private isFirstCheck = true
  private isFirstReplantLog = true
  private loopRunning = false
  private loopTimer: ReturnType<typeof setTimeout> | null = null
  private lastPushTime = 0
  private onOperationLimitsUpdate: OperationLimitsCallback | null = null

  constructor(
    private conn: Connection,
    private store: SessionStore,
  ) {}

  setOperationLimitsCallback(cb: OperationLimitsCallback): void {
    this.onOperationLimitsUpdate = cb
  }

  async getAllLands(): Promise<any> {
    const body = types.AllLandsRequest.encode(types.AllLandsRequest.create({})).finish()
    const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.plantpb.PlantService', 'AllLands', body)
    const reply = types.AllLandsReply.decode(replyBody) as any
    if (reply.operation_limits && this.onOperationLimitsUpdate) {
      this.onOperationLimitsUpdate(reply.operation_limits)
    }
    return reply
  }

  async harvest(landIds: number[]): Promise<any> {
    const body = types.HarvestRequest.encode(
      types.HarvestRequest.create({
        land_ids: landIds,
        host_gid: toLong(this.conn.userState.gid),
        is_all: true,
      }),
    ).finish()
    const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.plantpb.PlantService', 'Harvest', body)
    return types.HarvestReply.decode(replyBody)
  }

  async waterLand(landIds: number[]): Promise<any> {
    const body = types.WaterLandRequest.encode(
      types.WaterLandRequest.create({
        land_ids: landIds,
        host_gid: toLong(this.conn.userState.gid),
      }),
    ).finish()
    const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.plantpb.PlantService', 'WaterLand', body)
    return types.WaterLandReply.decode(replyBody)
  }

  async weedOut(landIds: number[]): Promise<any> {
    const body = types.WeedOutRequest.encode(
      types.WeedOutRequest.create({
        land_ids: landIds,
        host_gid: toLong(this.conn.userState.gid),
      }),
    ).finish()
    const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.plantpb.PlantService', 'WeedOut', body)
    return types.WeedOutReply.decode(replyBody)
  }

  async insecticide(landIds: number[]): Promise<any> {
    const body = types.InsecticideRequest.encode(
      types.InsecticideRequest.create({
        land_ids: landIds,
        host_gid: toLong(this.conn.userState.gid),
      }),
    ).finish()
    const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.plantpb.PlantService', 'Insecticide', body)
    return types.InsecticideReply.decode(replyBody)
  }

  async fertilize(landIds: number[], fertilizerId = NORMAL_FERTILIZER_ID): Promise<number> {
    let successCount = 0
    for (const landId of landIds) {
      try {
        const body = types.FertilizeRequest.encode(
          types.FertilizeRequest.create({
            land_ids: [toLong(landId)],
            fertilizer_id: toLong(fertilizerId),
          }),
        ).finish()
        await this.conn.sendMsgAsync('gamepb.plantpb.PlantService', 'Fertilize', body)
        successCount++
      } catch {
        break
      }
      if (landIds.length > 1) await sleep(50)
    }
    return successCount
  }

  async removePlant(landIds: number[]): Promise<any> {
    const body = types.RemovePlantRequest.encode(
      types.RemovePlantRequest.create({
        land_ids: landIds.map((id) => toLong(id)),
      }),
    ).finish()
    const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.plantpb.PlantService', 'RemovePlant', body)
    return types.RemovePlantReply.decode(replyBody)
  }

  async getShopInfo(shopId: number): Promise<any> {
    const body = types.ShopInfoRequest.encode(types.ShopInfoRequest.create({ shop_id: toLong(shopId) })).finish()
    const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.shoppb.ShopService', 'ShopInfo', body)
    return types.ShopInfoReply.decode(replyBody)
  }

  async buyGoods(goodsId: number, num: number, price: number): Promise<any> {
    const body = types.BuyGoodsRequest.encode(
      types.BuyGoodsRequest.create({
        goods_id: toLong(goodsId),
        num: toLong(num),
        price: toLong(price),
      }),
    ).finish()
    const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.shoppb.ShopService', 'BuyGoods', body)
    return types.BuyGoodsReply.decode(replyBody)
  }

  private encodePlantRequest(seedId: number, landIds: number[]): Uint8Array {
    const writer = Writer.create()
    const itemWriter = writer.uint32(18).fork()
    itemWriter.uint32(8).int64(seedId)
    const idsWriter = itemWriter.uint32(18).fork()
    for (const id of landIds) idsWriter.int64(id)
    idsWriter.ldelim()
    itemWriter.ldelim()
    return writer.finish()
  }

  async plantSeeds(seedId: number, landIds: number[]): Promise<number> {
    let successCount = 0
    for (const landId of landIds) {
      try {
        const body = this.encodePlantRequest(seedId, [landId])
        const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.plantpb.PlantService', 'Plant', body)
        types.PlantReply.decode(replyBody)
        successCount++
      } catch (e: any) {
        logWarn('种植', `土地#${landId} 失败: ${e.message}`)
      }
      if (landIds.length > 1) await sleep(50)
    }
    return successCount
  }

  async findBestSeed(landsCount: number): Promise<any> {
    const shopReply = await this.getShopInfo(SEED_SHOP_ID)
    if (!shopReply.goods_list?.length) {
      logWarn('商店', '种子商店无商品')
      return null
    }
    const state = this.conn.userState
    const available: any[] = []
    for (const goods of shopReply.goods_list) {
      if (!goods.unlocked) continue
      let meetsConditions = true
      let requiredLevel = 0
      for (const cond of goods.conds || []) {
        if (toNum(cond.type) === 1) {
          requiredLevel = toNum(cond.param)
          if (state.level < requiredLevel) {
            meetsConditions = false
            break
          }
        }
      }
      if (!meetsConditions) continue
      const limitCount = toNum(goods.limit_count)
      const boughtNum = toNum(goods.bought_num)
      if (limitCount > 0 && boughtNum >= limitCount) continue
      available.push({
        goods,
        goodsId: toNum(goods.id),
        seedId: toNum(goods.item_id),
        price: toNum(goods.price),
        requiredLevel,
      })
    }
    if (!available.length) {
      logWarn('商店', '没有可购买的种子')
      return null
    }
    if (config.forceLowestLevelCrop) {
      available.sort((a, b) => a.requiredLevel - b.requiredLevel || a.price - b.price)
      return available[0]
    }
    try {
      const rec = getPlantingRecommendation(state.level, landsCount ?? 18, { top: 50 })
      const rankedSeedIds = rec.candidatesNormalFert.map((x: any) => x.seedId)
      for (const seedId of rankedSeedIds) {
        const hit = available.find((x) => x.seedId === seedId)
        if (hit) return hit
      }
    } catch (e: any) {
      logWarn('商店', `经验效率推荐失败，使用兜底策略: ${e.message}`)
    }
    if (state.level && state.level <= 28) available.sort((a, b) => a.requiredLevel - b.requiredLevel)
    else available.sort((a, b) => b.requiredLevel - a.requiredLevel)
    return available[0]
  }

  async autoPlantEmptyLands(deadLandIds: number[], emptyLandIds: number[], unlockedLandCount: number): Promise<void> {
    let landsToPlant = [...emptyLandIds]
    const state = this.conn.userState
    if (deadLandIds.length > 0) {
      try {
        await this.removePlant(deadLandIds)
        log('铲除', `已铲除 ${deadLandIds.length} 块 (${deadLandIds.join(',')})`)
        landsToPlant.push(...deadLandIds)
      } catch (e: any) {
        logWarn('铲除', `批量铲除失败: ${e.message}`)
        landsToPlant.push(...deadLandIds)
      }
    }
    if (!landsToPlant.length) return
    let bestSeed: any
    try {
      bestSeed = await this.findBestSeed(unlockedLandCount)
    } catch (e: any) {
      logWarn('商店', `查询失败: ${e.message}`)
      return
    }
    if (!bestSeed) return
    const seedName = getPlantNameBySeedId(bestSeed.seedId)
    const growTime = getPlantGrowTime(1020000 + (bestSeed.seedId - 20000))
    const growTimeStr = growTime > 0 ? ` 生长${formatGrowTime(growTime)}` : ''
    log('商店', `最佳种子: ${seedName} (${bestSeed.seedId}) 价格=${bestSeed.price}金币${growTimeStr}`)
    const needCount = landsToPlant.length
    const totalCost = bestSeed.price * needCount
    if (totalCost > state.gold) {
      logWarn('商店', `金币不足! 需要 ${totalCost} 金币, 当前 ${state.gold} 金币`)
      const canBuy = Math.floor(state.gold / bestSeed.price)
      if (canBuy <= 0) return
      landsToPlant = landsToPlant.slice(0, canBuy)
      log('商店', `金币有限，只种 ${canBuy} 块地`)
    }
    let actualSeedId = bestSeed.seedId
    try {
      const buyReply = await this.buyGoods(bestSeed.goodsId, landsToPlant.length, bestSeed.price)
      if (buyReply.get_items?.length > 0) {
        const gotItem = buyReply.get_items[0]
        const gotId = toNum(gotItem.id)
        const gotCount = toNum(gotItem.count)
        log('购买', `获得物品: ${getItemName(gotId)}(${gotId}) x${gotCount}`)
        if (gotId > 0) actualSeedId = gotId
      }
      if (buyReply.cost_items) for (const item of buyReply.cost_items) state.gold -= toNum(item.count)
      log(
        '购买',
        `已购买 ${getPlantNameBySeedId(actualSeedId)}种子 x${landsToPlant.length}, 花费 ${bestSeed.price * landsToPlant.length} 金币`,
      )
    } catch (e: any) {
      logWarn('购买', e.message)
      return
    }
    let plantedLands: number[] = []
    try {
      const planted = await this.plantSeeds(actualSeedId, landsToPlant)
      log('种植', `已在 ${planted} 块地种植 (${landsToPlant.join(',')})`)
      if (planted > 0) plantedLands = landsToPlant.slice(0, planted)
    } catch (e: any) {
      logWarn('种植', e.message)
    }
    if (plantedLands.length > 0) {
      const fertilized = await this.fertilize(plantedLands)
      if (fertilized > 0) log('施肥', `已为 ${fertilized}/${plantedLands.length} 块地施肥`)
    }
  }

  getCurrentPhase(phases: any[]): any {
    if (!phases?.length) return null
    const nowSec = getServerTimeSec()
    for (let i = phases.length - 1; i >= 0; i--) {
      const beginTime = toTimeSec(phases[i].begin_time)
      if (beginTime > 0 && beginTime <= nowSec) return phases[i]
    }
    return phases[0]
  }

  analyzeLands(lands: any[]) {
    const result = {
      harvestable: [] as number[],
      needWater: [] as number[],
      needWeed: [] as number[],
      needBug: [] as number[],
      growing: [] as number[],
      empty: [] as number[],
      dead: [] as number[],
      harvestableInfo: [] as { landId: number; plantId: number; name: string; exp: number }[],
    }
    const nowSec = getServerTimeSec()
    for (const land of lands) {
      const id = toNum(land.id)
      if (!land.unlocked) continue
      const plant = land.plant
      if (!plant?.phases?.length) {
        result.empty.push(id)
        continue
      }
      const currentPhase = this.getCurrentPhase(plant.phases)
      if (!currentPhase) {
        result.empty.push(id)
        continue
      }
      const phaseVal = currentPhase.phase
      if (phaseVal === PlantPhase.DEAD) {
        result.dead.push(id)
        continue
      }
      if (phaseVal === PlantPhase.MATURE) {
        result.harvestable.push(id)
        const plantId = toNum(plant.id)
        result.harvestableInfo.push({
          landId: id,
          plantId,
          name: getPlantName(plantId) || plant.name,
          exp: getPlantExp(plantId),
        })
        continue
      }
      const dryNum = toNum(plant.dry_num)
      const dryTime = toTimeSec(currentPhase.dry_time)
      if (dryNum > 0 || (dryTime > 0 && dryTime <= nowSec)) result.needWater.push(id)
      const weedsTime = toTimeSec(currentPhase.weeds_time)
      if (plant.weed_owners?.length > 0 || (weedsTime > 0 && weedsTime <= nowSec)) result.needWeed.push(id)
      const insectTime = toTimeSec(currentPhase.insect_time)
      if (plant.insect_owners?.length > 0 || (insectTime > 0 && insectTime <= nowSec)) result.needBug.push(id)
      result.growing.push(id)
    }
    return result
  }

  async checkFarm(): Promise<void> {
    if (this.isChecking || !this.conn.userState.gid) return
    this.isChecking = true
    try {
      const landsReply = await this.getAllLands()
      if (!landsReply.lands?.length) {
        log('农场', '没有土地数据')
        return
      }
      const lands = landsReply.lands
      const status = this.analyzeLands(lands)
      const unlockedLandCount = lands.filter((l: any) => l?.unlocked).length
      this.isFirstCheck = false
      this.store.updateLands(lands)
      const statusParts: string[] = []
      if (status.harvestable.length) statusParts.push(`收:${status.harvestable.length}`)
      if (status.needWeed.length) statusParts.push(`草:${status.needWeed.length}`)
      if (status.needBug.length) statusParts.push(`虫:${status.needBug.length}`)
      if (status.needWater.length) statusParts.push(`水:${status.needWater.length}`)
      if (status.dead.length) statusParts.push(`枯:${status.dead.length}`)
      if (status.empty.length) statusParts.push(`空:${status.empty.length}`)
      statusParts.push(`长:${status.growing.length}`)
      const hasWork =
        status.harvestable.length ||
        status.needWeed.length ||
        status.needBug.length ||
        status.needWater.length ||
        status.dead.length ||
        status.empty.length
      const actions: string[] = []
      const batchOps: Promise<void>[] = []
      if (status.needWeed.length > 0)
        batchOps.push(
          this.weedOut(status.needWeed)
            .then(() => {
              actions.push(`除草${status.needWeed.length}`)
            })
            .catch((e) => logWarn('除草', e.message)),
        )
      if (status.needBug.length > 0)
        batchOps.push(
          this.insecticide(status.needBug)
            .then(() => {
              actions.push(`除虫${status.needBug.length}`)
            })
            .catch((e) => logWarn('除虫', e.message)),
        )
      if (status.needWater.length > 0)
        batchOps.push(
          this.waterLand(status.needWater)
            .then(() => {
              actions.push(`浇水${status.needWater.length}`)
            })
            .catch((e) => logWarn('浇水', e.message)),
        )
      if (batchOps.length > 0) await Promise.all(batchOps)
      let harvestedLandIds: number[] = []
      if (status.harvestable.length > 0) {
        try {
          await this.harvest(status.harvestable)
          actions.push(`收获${status.harvestable.length}`)
          harvestedLandIds = [...status.harvestable]
        } catch (e: any) {
          logWarn('收获', e.message)
        }
      }
      const allDeadLands = [...status.dead, ...harvestedLandIds]
      if (allDeadLands.length > 0 || status.empty.length > 0) {
        try {
          await this.autoPlantEmptyLands(allDeadLands, status.empty, unlockedLandCount)
          actions.push(`种植${allDeadLands.length + status.empty.length}`)
        } catch (e: any) {
          logWarn('种植', e.message)
        }
      }
      const actionStr = actions.length > 0 ? ` → ${actions.join('/')}` : ''
      if (hasWork) log('农场', `[${statusParts.join(' ')}]${actionStr}`)
      if (this.isFirstReplantLog) {
        this.isFirstReplantLog = false
        this.logBestSeedOnStartup(unlockedLandCount)
      }
      if (config.autoReplantMode === 'always' && status.growing.length > 0)
        await this.autoReplantIfNeeded(lands, unlockedLandCount, 'check')
    } catch (err: any) {
      logWarn('巡田', `检查失败: ${err.message}`)
    } finally {
      this.isChecking = false
    }
  }

  private async autoReplantIfNeeded(lands: any[], unlockedLandCount: number, trigger: string): Promise<void> {
    const state = this.conn.userState
    if (config.forceLowestLevelCrop) return
    let bestSeedId: number
    let bestSeedName: string
    try {
      const rec = getPlantingRecommendation(state.level, unlockedLandCount, { top: 50 })
      const candidates = rec.candidatesNormalFert
      if (!candidates?.length) return
      bestSeedId = candidates[0].seedId
      bestSeedName = candidates[0].name
    } catch (e: any) {
      logWarn('换种', `获取推荐失败: ${e.message}`)
      return
    }
    const nowSec = getServerTimeSec()
    const toReplant: number[] = []
    let protectedCount = 0
    let alreadyBestCount = 0
    for (const land of lands) {
      const id = toNum(land.id)
      if (!land.unlocked) continue
      const plant = land.plant
      if (!plant?.phases?.length) continue
      const currentPhase = this.getCurrentPhase(plant.phases)
      if (!currentPhase) continue
      const phaseVal = currentPhase.phase
      if (phaseVal < PlantPhase.SEED || phaseVal > PlantPhase.BLOOMING) continue
      const plantId = toNum(plant.id)
      const currentSeedId = getSeedIdByPlantId(plantId)
      if (currentSeedId === bestSeedId) {
        alreadyBestCount++
        continue
      }
      const firstPhaseBegin = toTimeSec(plant.phases[0].begin_time)
      let matureBegin = 0
      for (const p of plant.phases) {
        if (p.phase === PlantPhase.MATURE) {
          matureBegin = toTimeSec(p.begin_time)
          break
        }
      }
      if (matureBegin > firstPhaseBegin && firstPhaseBegin > 0) {
        const progress = ((nowSec - firstPhaseBegin) / (matureBegin - firstPhaseBegin)) * 100
        if (progress >= config.replantProtectPercent) {
          protectedCount++
          continue
        }
      }
      toReplant.push(id)
    }
    if (!toReplant.length) {
      if (trigger === 'levelup')
        log(
          '换种',
          `最佳种子: ${bestSeedName}(${bestSeedId}), 无需换种 (最优${alreadyBestCount}, 保护${protectedCount})`,
        )
      return
    }
    log('换种', `铲除${toReplant.length}块, 保护${protectedCount}块, 新种: ${bestSeedName}(${bestSeedId})`)
    try {
      await this.autoPlantEmptyLands(toReplant, [], unlockedLandCount)
    } catch (e: any) {
      logWarn('换种', `操作失败: ${e.message}`)
    }
  }

  private logBestSeedOnStartup(unlockedLandCount: number): void {
    const state = this.conn.userState
    if (config.forceLowestLevelCrop) return
    try {
      const rec = getPlantingRecommendation(state.level, unlockedLandCount, { top: 50 })
      const best = rec.candidatesNormalFert?.[0]
      if (best)
        log('换种', `Lv${state.level} 最佳种子: ${best.name}(${best.seedId}) ${best.expPerHour.toFixed(2)}exp/h`)
    } catch {}
  }

  private onLandsChangedPush = (): void => {
    if (this.isChecking) return
    const now = Date.now()
    if (now - this.lastPushTime < 500) return
    this.lastPushTime = now
    log('农场', '收到推送: 土地变化，检查中...')
    setTimeout(() => {
      if (!this.isChecking) this.checkFarm()
    }, 100)
  }

  private onLevelUpReplant = async ({ oldLevel, newLevel }: { oldLevel: number; newLevel: number }): Promise<void> => {
    log('换种', `Lv${oldLevel}→Lv${newLevel} 检查是否需要换种...`)
    try {
      const landsReply = await this.getAllLands()
      if (!landsReply.lands?.length) return
      const lands = landsReply.lands
      const unlockedLandCount = lands.filter((l: any) => l?.unlocked).length
      let oldBest: any
      let newBest: any
      try {
        oldBest = getPlantingRecommendation(oldLevel, unlockedLandCount, { top: 50 }).candidatesNormalFert?.[0]
        newBest = getPlantingRecommendation(newLevel, unlockedLandCount, { top: 50 }).candidatesNormalFert?.[0]
      } catch {}
      if (oldBest && newBest && oldBest.seedId === newBest.seedId) {
        log('换种', `Lv${oldLevel}→Lv${newLevel} 最佳种子未变: ${newBest.name}(${newBest.seedId})`)
        return
      }
      if (oldBest && newBest) log('换种', `Lv${oldLevel}→Lv${newLevel} 最佳种子变化: ${oldBest.name}→${newBest.name}`)
      await this.autoReplantIfNeeded(lands, unlockedLandCount, 'levelup')
    } catch (e: any) {
      logWarn('换种', `升级换种失败: ${e.message}`)
    }
  }

  start(): void {
    if (this.loopRunning) return
    this.loopRunning = true
    this.conn.on('landsChanged', this.onLandsChangedPush)
    if (config.autoReplantMode === 'levelup') this.conn.on('levelUp', this.onLevelUpReplant)
    this.loopTimer = setTimeout(() => this.loop(), 2000)
  }

  private async loop(): Promise<void> {
    while (this.loopRunning) {
      await this.checkFarm()
      if (!this.loopRunning) break
      await sleep(config.farmCheckInterval)
    }
  }

  stop(): void {
    this.loopRunning = false
    if (this.loopTimer) {
      clearTimeout(this.loopTimer)
      this.loopTimer = null
    }
    this.conn.removeListener('landsChanged', this.onLandsChangedPush)
    this.conn.removeListener('levelUp', this.onLevelUpReplant)
  }
}
