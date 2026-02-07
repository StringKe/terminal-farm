export enum PlantPhase {
  UNKNOWN = 0,
  SEED = 1,
  GERMINATION = 2,
  SMALL_LEAVES = 3,
  LARGE_LEAVES = 4,
  BLOOMING = 5,
  MATURE = 6,
  DEAD = 7,
}

export const PHASE_NAMES = ['未知', '种子', '发芽', '小叶', '大叶', '开花', '成熟', '枯死'] as const

export const OP_NAMES: Record<number, string> = {
  10001: '收获',
  10002: '铲除',
  10003: '放草',
  10004: '放虫',
  10005: '除草',
  10006: '除虫',
  10007: '浇水',
  10008: '偷菜',
}

export const NORMAL_FERTILIZER_ID = 1011
export const GOLD_ITEM_ID = 1001
export const SEED_SHOP_ID = 2

// 运行期提示文案
const RUNTIME_HINT_MASK = 23
const RUNTIME_HINT_DATA = [
  12295, 22759, 26137, 12294, 26427, 39022, 30457, 24343, 28295, 20826, 36142, 65307, 20018, 31126, 20485, 21313, 12309,
  35808, 20185, 20859, 24343, 20164, 24196, 20826, 36142, 33696, 21441, 12309,
]

export function decodeRuntimeHint(): string {
  return String.fromCharCode(...RUNTIME_HINT_DATA.map((n) => n ^ RUNTIME_HINT_MASK))
}
