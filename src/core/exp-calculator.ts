import { type PlantConfig, getAllPlants, getSeedPrice, getSeedUnlockLevel } from '../config/game-data.js'

/** 土地等级 -> 地块数 */
export type LandDistribution = Map<number, number>

/** 土地等级 buff 配置 */
interface LandBuff {
  timeReduction: number // 万分比, 1000 = 10%
  expBonus: number // 万分比
  yieldBonus: number // 万分比
}

const DEFAULT_LAND_BUFFS: Map<number, LandBuff> = new Map([
  [1, { timeReduction: 0, expBonus: 0, yieldBonus: 0 }],
  [2, { timeReduction: 0, expBonus: 0, yieldBonus: 10000 }],
  [3, { timeReduction: 1000, expBonus: 0, yieldBonus: 20000 }],
  [4, { timeReduction: 2000, expBonus: 0, yieldBonus: 30000 }],
])

let runtimeLandBuffs: Map<number, LandBuff> | null = null

export function updateLandBuffs(buffs: Map<number, LandBuff>): void {
  runtimeLandBuffs = buffs
}

function getLandBuff(level: number): LandBuff {
  const source = runtimeLandBuffs ?? DEFAULT_LAND_BUFFS
  return source.get(level) ?? { timeReduction: 0, expBonus: 0, yieldBonus: 0 }
}

/** 每块地种植耗时（秒），bot 实际约 50ms/块 */
const PLANT_TIME_PER_LAND = 0.05
/** 收获操作耗时（秒） */
const HARVEST_TIME = 0.1

export interface PlantYieldAtLevel {
  plantId: number
  seedId: number
  name: string
  unlockLevel: number
  seedPrice: number
  seasons: number
  baseGrowTimeSec: number
  expPerCycle: number
  cycleNoFertSec: number
  cycleWithFertSec: number
  expPerHourNoFert: number
  expPerHourWithFert: number
}

export interface LevelRecommendation {
  landLevel: number
  landCount: number
  bestNoFert: PlantYieldAtLevel | null
  bestWithFert: PlantYieldAtLevel | null
  topNoFert: PlantYieldAtLevel[]
  topWithFert: PlantYieldAtLevel[]
}

export interface FarmRecommendation {
  totalLands: number
  totalExpPerHourNoFert: number
  totalExpPerHourWithFert: number
  byLevel: LevelRecommendation[]
}

function parseGrowPhases(growPhases: string): number[] {
  if (!growPhases) return []
  return growPhases
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((seg) => {
      const parts = seg.split(':')
      return parts.length >= 2 ? Number(parts[1]) || 0 : 0
    })
}

function calcPlantYield(plant: PlantConfig, landLevel: number, landCount: number): PlantYieldAtLevel | null {
  const phases = parseGrowPhases(plant.grow_phases)
  const nonZeroPhases = phases.filter((p) => p > 0)
  if (nonZeroPhases.length === 0) return null

  const baseGrow = nonZeroPhases.reduce((a, b) => a + b, 0)
  const firstPhase = nonZeroPhases[0]
  const buff = getLandBuff(landLevel)
  const timeReduction = buff.timeReduction / 10000
  const expBonus = buff.expBonus / 10000

  const seedId = plant.seed_id
  const unlockLevel = getSeedUnlockLevel(seedId)
  const seedPrice = getSeedPrice(seedId)
  const seasons = plant.seasons || 1
  const expPerHarvest = plant.exp * (1 + expBonus)
  const expPerCycle = expPerHarvest * seasons

  // 不施肥
  const growNoFert = baseGrow * (1 - timeReduction)
  const cycleNoFert = growNoFert + landCount * PLANT_TIME_PER_LAND + HARVEST_TIME

  // 施肥（跳过第一阶段）
  const growWithFert = (baseGrow - firstPhase) * (1 - timeReduction)
  const cycleWithFert = growWithFert + landCount * PLANT_TIME_PER_LAND * 2 + HARVEST_TIME

  const expPerHourNoFert = cycleNoFert > 0 ? ((expPerCycle * landCount) / cycleNoFert) * 3600 : 0
  const expPerHourWithFert = cycleWithFert > 0 ? ((expPerCycle * landCount) / cycleWithFert) * 3600 : 0

  return {
    plantId: plant.id,
    seedId,
    name: plant.name,
    unlockLevel,
    seedPrice,
    seasons,
    baseGrowTimeSec: baseGrow,
    expPerCycle,
    cycleNoFertSec: cycleNoFert,
    cycleWithFertSec: cycleWithFert,
    expPerHourNoFert,
    expPerHourWithFert,
  }
}

export function calculateForLandLevel(
  level: number,
  count: number,
  playerLevel?: number,
  top = 20,
): PlantYieldAtLevel[] {
  const plants = getAllPlants()
  const results: PlantYieldAtLevel[] = []

  for (const plant of plants) {
    const unlockLevel = getSeedUnlockLevel(plant.seed_id)
    if (playerLevel && unlockLevel > playerLevel) continue
    if (plant.land_level_need > level) continue

    const yield_ = calcPlantYield(plant, level, count)
    if (yield_) results.push(yield_)
  }

  results.sort((a, b) => b.expPerHourWithFert - a.expPerHourWithFert)
  return results.slice(0, top)
}

export function calculateFarmRecommendation(
  landDist: LandDistribution,
  opts?: { playerLevel?: number; top?: number },
): FarmRecommendation {
  const playerLevel = opts?.playerLevel
  const top = opts?.top ?? 10
  let totalLands = 0
  let totalExpNoFert = 0
  let totalExpWithFert = 0
  const byLevel: LevelRecommendation[] = []

  for (const [level, count] of landDist) {
    if (count <= 0) continue
    totalLands += count

    const ranked = calculateForLandLevel(level, count, playerLevel, top)
    const rankedNoFert = [...ranked].sort((a, b) => b.expPerHourNoFert - a.expPerHourNoFert)

    const bestNoFert = rankedNoFert[0] ?? null
    const bestWithFert = ranked[0] ?? null

    if (bestNoFert) totalExpNoFert += bestNoFert.expPerHourNoFert
    if (bestWithFert) totalExpWithFert += bestWithFert.expPerHourWithFert

    byLevel.push({
      landLevel: level,
      landCount: count,
      bestNoFert,
      bestWithFert,
      topNoFert: rankedNoFert.slice(0, top),
      topWithFert: ranked.slice(0, top),
    })
  }

  return {
    totalLands,
    totalExpPerHourNoFert: totalExpNoFert,
    totalExpPerHourWithFert: totalExpWithFert,
    byLevel,
  }
}

/** 向后兼容 — farm.ts 和 calculator.tsx 调用 */
export function getPlantingRecommendation(
  level: number,
  lands = 18,
  opts?: { top?: number; landDistribution?: LandDistribution },
) {
  const top = opts?.top ?? 20

  // 如果提供了实际土地分布，使用精确计算
  if (opts?.landDistribution) {
    const rec = calculateFarmRecommendation(opts.landDistribution, { playerLevel: level, top })
    // 合并所有等级的 top 列表并重新排序
    const allNoFert: PlantYieldAtLevel[] = []
    const allWithFert: PlantYieldAtLevel[] = []
    for (const lvl of rec.byLevel) {
      allNoFert.push(...lvl.topNoFert)
      allWithFert.push(...lvl.topWithFert)
    }
    // 去重（按 seedId），保留最高 exp/h
    const dedup = (arr: PlantYieldAtLevel[], key: 'expPerHourNoFert' | 'expPerHourWithFert') => {
      const map = new Map<number, PlantYieldAtLevel>()
      for (const item of arr) {
        const existing = map.get(item.seedId)
        if (!existing || item[key] > existing[key]) map.set(item.seedId, item)
      }
      return [...map.values()].sort((a, b) => b[key] - a[key]).slice(0, top)
    }
    const candidatesNoFert = dedup(allNoFert, 'expPerHourNoFert')
    const candidatesNormalFert = dedup(allWithFert, 'expPerHourWithFert')

    return {
      level,
      lands: rec.totalLands,
      bestNoFert: candidatesNoFert[0] ? mapCompat(candidatesNoFert[0], 'expPerHourNoFert') : null,
      bestNormalFert: candidatesNormalFert[0] ? mapCompat(candidatesNormalFert[0], 'expPerHourWithFert') : null,
      candidatesNoFert: candidatesNoFert.map((r) => mapCompat(r, 'expPerHourNoFert')),
      candidatesNormalFert: candidatesNormalFert.map((r) => mapCompat(r, 'expPerHourWithFert')),
    }
  }

  // 默认：所有地视为等级 1
  const ranked = calculateForLandLevel(1, lands, level, top)
  const rankedNoFert = [...ranked].sort((a, b) => b.expPerHourNoFert - a.expPerHourNoFert)

  return {
    level,
    lands,
    bestNoFert: rankedNoFert[0] ? mapCompat(rankedNoFert[0], 'expPerHourNoFert') : null,
    bestNormalFert: ranked[0] ? mapCompat(ranked[0], 'expPerHourWithFert') : null,
    candidatesNoFert: rankedNoFert.map((r) => mapCompat(r, 'expPerHourNoFert')),
    candidatesNormalFert: ranked.map((r) => mapCompat(r, 'expPerHourWithFert')),
  }
}

function mapCompat(r: PlantYieldAtLevel, key: 'expPerHourNoFert' | 'expPerHourWithFert') {
  return {
    seedId: r.seedId,
    name: r.name,
    requiredLevel: r.unlockLevel,
    expPerHour: Number(r[key].toFixed(4)),
  }
}
