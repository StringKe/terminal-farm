import { getItemName } from '../config/game-data.js'
import { toNum } from './long.js'

/** 将奖励物品数组格式化为可读字符串，如 "金币500/经验100/萝卜种子(20001)x3" */
export function formatRewards(items: any[]): string {
  return items
    .map((r: any) => {
      const id = toNum(r.id)
      const count = toNum(r.count)
      if (id === 1) return `金币${count}`
      if (id === 2) return `经验${count}`
      return `${getItemName(id)}(${id})x${count}`
    })
    .join('/')
}

/** 格式化单个奖励物品名称 */
export function formatRewardName(id: number): string {
  if (id === 1) return '金币'
  if (id === 2) return '经验'
  return getItemName(id)
}
