#!/usr/bin/env bun
/**
 * 计算 1-200 级每级最优作物选择
 * 用法: bun run tools/calc-exp-yield.ts [--lands N] [--level N]
 */

import { parseArgs } from 'node:util'
import { formatGrowTime } from '../src/config/game-data.js'
import { DEFAULT_TIMING, type PlantYieldAtLevel, calculateForLandLevel } from '../src/core/exp-calculator.js'

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    lands: { type: 'string', default: '18' },
    level: { type: 'string' },
  },
})

const lands = Number(values.lands) || 18

// 单级模式
if (values.level) {
  const level = Number(values.level)
  const ranked = calculateForLandLevel(1, lands, level, 20, DEFAULT_TIMING)
  console.log(`\nLv${level} | ${lands}块地 | 前20最优作物:\n`)
  console.log('排名  种子ID  名称            解锁  价格    季数  生长时间      exp/周期  exp/h(施肥)  exp/h(无肥)')
  console.log('-'.repeat(105))
  for (let i = 0; i < ranked.length; i++) {
    const r = ranked[i]
    console.log(
      `#${String(i + 1).padStart(2)}  ${String(r.seedId).padStart(5)}  ${r.name.padEnd(14)}  Lv${String(r.unlockLevel).padStart(3)}  ${String(r.seedPrice).padStart(6)}  ${String(r.seasons).padStart(4)}  ${formatGrowTime(r.baseGrowTimeSec).padStart(12)}  ${String(r.expPerCycle).padStart(8)}  ${r.expPerHourWithFert.toFixed(1).padStart(11)}  ${r.expPerHourNoFert.toFixed(1).padStart(11)}`,
    )
  }
  process.exit(0)
}

// 全等级模式: 1-200
console.log(`\n作物选择表 (${lands}块地)\n`)
console.log('等级范围          最优作物        种子ID  价格    生长时间      exp/周期  exp/h(施肥)')
console.log('-'.repeat(95))

let prevBest: PlantYieldAtLevel | null = null
let rangeStart = 1

function printRange(start: number, end: number, best: PlantYieldAtLevel) {
  const range = start === end ? `Lv${start}` : `Lv${start}-${end}`
  console.log(
    `${range.padEnd(18)}${best.name.padEnd(16)}${String(best.seedId).padStart(5)}  ${String(best.seedPrice).padStart(6)}  ${formatGrowTime(best.baseGrowTimeSec).padStart(12)}  ${String(best.expPerCycle).padStart(8)}  ${best.expPerHourWithFert.toFixed(1).padStart(11)}`,
  )
}

for (let level = 1; level <= 200; level++) {
  const ranked = calculateForLandLevel(1, lands, level, 1, DEFAULT_TIMING)
  const best = ranked[0] ?? null

  if (!best) {
    if (prevBest) {
      printRange(rangeStart, level - 1, prevBest)
      prevBest = null
    }
    continue
  }

  if (prevBest && prevBest.seedId !== best.seedId) {
    printRange(rangeStart, level - 1, prevBest)
    rangeStart = level
  } else if (!prevBest) {
    rangeStart = level
  }

  prevBest = best
}

if (prevBest) {
  printRange(rangeStart, 200, prevBest)
}

// 详细表: 每个等级变化点
console.log('\n\n变化点详情:\n')
console.log('等级  最优作物        种子ID  解锁  价格    生长时间      exp  季数  exp/h(施肥)  exp/h(无肥)')
console.log('-'.repeat(100))

let lastSeedId = -1
for (let level = 1; level <= 200; level++) {
  const ranked = calculateForLandLevel(1, lands, level, 1, DEFAULT_TIMING)
  const best = ranked[0]
  if (!best) continue
  if (best.seedId === lastSeedId) continue
  lastSeedId = best.seedId
  console.log(
    `Lv${String(level).padStart(3)}  ${best.name.padEnd(14)}${String(best.seedId).padStart(5)}  Lv${String(best.unlockLevel).padStart(3)}  ${String(best.seedPrice).padStart(6)}  ${formatGrowTime(best.baseGrowTimeSec).padStart(12)}  ${String(Math.round(best.expPerCycle)).padStart(3)}  ${String(best.seasons).padStart(4)}  ${best.expPerHourWithFert.toFixed(1).padStart(11)}  ${best.expPerHourNoFert.toFixed(1).padStart(11)}`,
  )
}
