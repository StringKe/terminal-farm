import { readFileSync } from 'node:fs'
import { join } from 'node:path'

interface PlantConfig {
  id: number
  name: string
  seed_id: number
  fruit: { id: number; count: number }
  exp: number
  grow_phases: string
  level_unlock: number
}

interface ItemInfoConfig {
  id: number
  name: string
  type?: number
  description?: string
}

interface RoleLevelConfig {
  level: number
  exp: number
}

const GAME_CONFIG_DIR = join(import.meta.dir, '..', '..', 'game-config')

const plantMap = new Map<number, PlantConfig>()
const seedToPlant = new Map<number, PlantConfig>()
const fruitToPlant = new Map<number, PlantConfig>()
const itemInfoMap = new Map<number, ItemInfoConfig>()
let levelExpTable: number[] = []

export function loadConfigs(): void {
  // Role level
  try {
    const data: RoleLevelConfig[] = JSON.parse(readFileSync(join(GAME_CONFIG_DIR, 'RoleLevel.json'), 'utf8'))
    levelExpTable = []
    for (const item of data) {
      levelExpTable[item.level] = item.exp
    }
  } catch {}

  // Plants
  try {
    const data: PlantConfig[] = JSON.parse(readFileSync(join(GAME_CONFIG_DIR, 'Plant.json'), 'utf8'))
    plantMap.clear()
    seedToPlant.clear()
    fruitToPlant.clear()
    for (const plant of data) {
      plantMap.set(plant.id, plant)
      if (plant.seed_id) seedToPlant.set(plant.seed_id, plant)
      if (plant.fruit?.id) fruitToPlant.set(plant.fruit.id, plant)
    }
  } catch {}

  // Items
  try {
    const data: ItemInfoConfig[] = JSON.parse(readFileSync(join(GAME_CONFIG_DIR, 'ItemInfo.json'), 'utf8'))
    itemInfoMap.clear()
    for (const item of data) {
      const id = Number(item.id) || 0
      if (id > 0) itemInfoMap.set(id, item)
    }
  } catch {}
}

export function getLevelExpTable(): number[] {
  return levelExpTable
}

export function getLevelExpProgress(level: number, totalExp: number): { current: number; needed: number } {
  if (!levelExpTable.length || level <= 0) return { current: 0, needed: 0 }
  const currentLevelStart = levelExpTable[level] || 0
  const nextLevelStart = levelExpTable[level + 1] || currentLevelStart + 100000
  return {
    current: Math.max(0, totalExp - currentLevelStart),
    needed: nextLevelStart - currentLevelStart,
  }
}

export function getPlantName(plantId: number): string {
  return plantMap.get(plantId)?.name ?? `植物${plantId}`
}

export function getPlantNameBySeedId(seedId: number): string {
  return seedToPlant.get(seedId)?.name ?? `种子${seedId}`
}

export function getPlantExp(plantId: number): number {
  return plantMap.get(plantId)?.exp ?? 0
}

export function getPlantGrowTime(plantId: number): number {
  const plant = plantMap.get(plantId)
  if (!plant?.grow_phases) return 0
  return plant.grow_phases
    .split(';')
    .filter(Boolean)
    .reduce((total, phase) => {
      const match = phase.match(/:(\d+)/)
      return total + (match ? Number.parseInt(match[1]) : 0)
    }, 0)
}

export function formatGrowTime(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return mins > 0 ? `${hours}小时${mins}分` : `${hours}小时`
}

export function getFruitName(fruitId: number): string {
  return fruitToPlant.get(fruitId)?.name ?? `果实${fruitId}`
}

export function getItemName(itemId: number): string {
  const id = Number(itemId) || 0
  const info = itemInfoMap.get(id)
  if (info?.name) return String(info.name)
  const seedPlant = seedToPlant.get(id)
  if (seedPlant) return `${seedPlant.name}种子`
  const fruitPlant = fruitToPlant.get(id)
  if (fruitPlant) return `${fruitPlant.name}果实`
  return '未知物品'
}

export function getSeedIdByPlantId(plantId: number): number | null {
  const plant = plantMap.get(plantId)
  return plant?.seed_id ?? null
}

export function getPlantById(plantId: number): PlantConfig | undefined {
  return plantMap.get(plantId)
}

// Auto-load on import
loadConfigs()
