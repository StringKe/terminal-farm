/**
 * 经验收益率计算器
 *
 * 规则：
 * 1) 每次收获经验 = exp
 * 2) 种植速度：不施肥 9块/秒，普通肥 6块/秒
 * 3) 普通肥：直接减少一个生长阶段
 *
 * 用法：
 *   bun run tools/calc-exp-yield.ts
 *   bun run tools/calc-exp-yield.ts --lands 18 --level 27
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const TOOLS_DIR = import.meta.dir
const DEFAULT_INPUT = join(TOOLS_DIR, 'seed-shop-merged-export.json')
const PLANT_CONFIG_PATH = join(TOOLS_DIR, '..', 'game-config', 'Plant.json')
const DEFAULT_OUT_JSON = join(TOOLS_DIR, 'exp-yield-result.json')
const DEFAULT_OUT_CSV = join(TOOLS_DIR, 'exp-yield-result.csv')
const DEFAULT_OUT_TXT = join(TOOLS_DIR, 'exp-yield-summary.txt')

const NO_FERT_PLANTS_PER_2_SEC = 18
const NORMAL_FERT_PLANTS_PER_2_SEC = 12
const NO_FERT_PLANT_SPEED_PER_SEC = NO_FERT_PLANTS_PER_2_SEC / 2
const NORMAL_FERT_PLANT_SPEED_PER_SEC = NORMAL_FERT_PLANTS_PER_2_SEC / 2

function toNum(v: any, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

interface CliOpts {
  input: string
  outJson: string
  outCsv: string
  outTxt: string
  lands: number
  level: number | null
  top: number
}

function parseArgs(argv: string[]): CliOpts {
  const opts: CliOpts = {
    input: DEFAULT_INPUT,
    outJson: DEFAULT_OUT_JSON,
    outCsv: DEFAULT_OUT_CSV,
    outTxt: DEFAULT_OUT_TXT,
    lands: 18,
    level: null,
    top: 20,
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--input' && argv[i + 1]) opts.input = argv[++i]
    else if (a === '--out-json' && argv[i + 1]) opts.outJson = argv[++i]
    else if (a === '--out-csv' && argv[i + 1]) opts.outCsv = argv[++i]
    else if (a === '--out-txt' && argv[i + 1]) opts.outTxt = argv[++i]
    else if (a === '--lands' && argv[i + 1]) opts.lands = Math.max(1, Math.floor(toNum(argv[++i], 18)))
    else if (a === '--level' && argv[i + 1]) opts.level = Math.max(1, Math.floor(toNum(argv[++i], 1)))
    else if (a === '--top' && argv[i + 1]) opts.top = Math.max(1, Math.floor(toNum(argv[++i], 20)))
    else if (a === '--help' || a === '-h') {
      console.log('Usage: bun run tools/calc-exp-yield.ts [options]')
      console.log('')
      console.log('Options:')
      console.log('  --input <path>      输入 JSON 文件路径')
      console.log('  --lands <n>         地块数（默认 18）')
      console.log('  --level <n>         指定账号等级')
      console.log('  --top <n>           摘要 Top 数量（默认 20）')
      process.exit(0)
    }
  }
  return opts
}

function readSeeds(inputPath: string): any[] {
  const data = JSON.parse(readFileSync(inputPath, 'utf8'))
  if (Array.isArray(data)) return data
  if (data?.rows) return data.rows
  if (data?.seeds) return data.seeds
  throw new Error('无法识别输入数据格式')
}

function parseGrowPhases(growPhases: string | undefined): number[] {
  if (!growPhases || typeof growPhases !== 'string') return []
  return growPhases
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((seg) => {
      const parts = seg.split(':')
      return parts.length >= 2 ? toNum(parts[1], 0) : 0
    })
    .filter((sec) => sec > 0)
}

function loadSeedPhaseReduceMap(): Map<number, number> {
  const rows = JSON.parse(readFileSync(PLANT_CONFIG_PATH, 'utf8'))
  if (!Array.isArray(rows)) throw new Error(`Plant 配置格式异常: ${PLANT_CONFIG_PATH}`)

  const map = new Map<number, number>()
  for (const p of rows) {
    const seedId = toNum(p.seed_id, 0)
    if (seedId <= 0 || map.has(seedId)) continue
    const phases = parseGrowPhases(p.grow_phases)
    if (phases.length === 0) continue
    map.set(seedId, phases[0])
  }
  return map
}

function calcEffectiveGrowTime(growSec: number, seedId: number, seedPhaseReduceMap: Map<number, number>): number {
  const reduce = toNum(seedPhaseReduceMap.get(seedId), 0)
  if (reduce <= 0) return growSec
  return Math.max(1, growSec - reduce)
}

function formatSec(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m < 60) return r > 0 ? `${m}m${r}s` : `${m}m`
  const h = Math.floor(m / 60)
  const mm = m % 60
  return r > 0 ? `${h}h${mm}m${r}s` : `${h}h${mm}m`
}

function csvCell(v: any): string {
  const s = v == null ? '' : String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

interface YieldRow {
  seedId: number
  goodsId: number
  plantId: number
  name: string
  requiredLevel: number
  unlocked: boolean
  price: number
  expHarvest: number
  expPerCycle: number
  growTimeSec: number
  growTimeStr: string
  normalFertReduceSec: number
  growTimeNormalFert: number
  growTimeNormalFertStr: string
  cycleSecNoFert: number
  cycleSecNormalFert: number
  farmExpPerHourNoFert: number
  farmExpPerHourNormalFert: number
  farmExpPerDayNoFert: number
  farmExpPerDayNormalFert: number
  gainPercent: number
  expPerGoldSeed: number
  fruitId: number
  fruitCount: number
}

function buildRows(rawSeeds: any[], lands: number, seedPhaseReduceMap: Map<number, number>) {
  const plantSecondsNoFert = lands / NO_FERT_PLANT_SPEED_PER_SEC
  const plantSecondsNormalFert = lands / NORMAL_FERT_PLANT_SPEED_PER_SEC
  const rows: YieldRow[] = []
  let skipped = 0
  let missingPhaseReduceCount = 0

  for (const s of rawSeeds) {
    const seedId = toNum(s.seedId || s.seed_id)
    const name = s.name || `seed_${seedId}`
    const requiredLevel = toNum(s.requiredLevel || s.required_level || 1, 1)
    const price = toNum(s.price, 0)
    const expHarvest = toNum(s.exp, 0)
    const growTimeSec = toNum(s.growTimeSec || s.growTime || s.grow_time || 0, 0)

    if (seedId <= 0 || growTimeSec <= 0) {
      skipped++
      continue
    }

    const expPerCycle = expHarvest
    const reduceSec = toNum(seedPhaseReduceMap.get(seedId), 0)
    if (reduceSec <= 0) missingPhaseReduceCount++
    const growTimeNormalFert = calcEffectiveGrowTime(growTimeSec, seedId, seedPhaseReduceMap)

    const cycleSecNoFert = growTimeSec + plantSecondsNoFert
    const cycleSecNormalFert = growTimeNormalFert + plantSecondsNormalFert

    const farmExpPerHourNoFert = ((lands * expPerCycle) / cycleSecNoFert) * 3600
    const farmExpPerHourNormalFert = ((lands * expPerCycle) / cycleSecNormalFert) * 3600
    const gainPercent =
      farmExpPerHourNoFert > 0 ? ((farmExpPerHourNormalFert - farmExpPerHourNoFert) / farmExpPerHourNoFert) * 100 : 0

    rows.push({
      seedId,
      goodsId: toNum(s.goodsId || s.goods_id),
      plantId: toNum(s.plantId || s.plant_id),
      name,
      requiredLevel,
      unlocked: !!s.unlocked,
      price,
      expHarvest,
      expPerCycle,
      growTimeSec,
      growTimeStr: s.growTimeStr || formatSec(growTimeSec),
      normalFertReduceSec: reduceSec,
      growTimeNormalFert,
      growTimeNormalFertStr: formatSec(growTimeNormalFert),
      cycleSecNoFert,
      cycleSecNormalFert,
      farmExpPerHourNoFert,
      farmExpPerHourNormalFert,
      farmExpPerDayNoFert: farmExpPerHourNoFert * 24,
      farmExpPerDayNormalFert: farmExpPerHourNormalFert * 24,
      gainPercent,
      expPerGoldSeed: price > 0 ? expPerCycle / price : 0,
      fruitId: toNum(s?.fruit?.id || s.fruitId),
      fruitCount: toNum(s?.fruit?.count || s.fruitCount),
    })
  }

  return { rows, skipped, plantSecondsNoFert, plantSecondsNormalFert, missingPhaseReduceCount }
}

function pickTop(rows: YieldRow[], key: keyof YieldRow, topN: number): YieldRow[] {
  return [...rows].sort((a, b) => (b[key] as number) - (a[key] as number)).slice(0, topN)
}

function buildBestByLevel(rows: YieldRow[]) {
  const maxLevel = rows.reduce((m, r) => Math.max(m, r.requiredLevel), 1)
  const result = []
  for (let lv = 1; lv <= maxLevel; lv++) {
    const available = rows.filter((r) => r.requiredLevel <= lv)
    if (available.length === 0) continue
    const bestNo = pickTop(available, 'farmExpPerHourNoFert', 1)[0]
    const bestFert = pickTop(available, 'farmExpPerHourNormalFert', 1)[0]
    result.push({
      level: lv,
      bestNoFert: {
        seedId: bestNo.seedId,
        name: bestNo.name,
        expPerHour: Number(bestNo.farmExpPerHourNoFert.toFixed(2)),
      },
      bestNormalFert: {
        seedId: bestFert.seedId,
        name: bestFert.name,
        expPerHour: Number(bestFert.farmExpPerHourNormalFert.toFixed(2)),
      },
    })
  }
  return result
}

export function analyzeExpYield(opts: Partial<CliOpts> = {}) {
  const lands = Math.max(1, Math.floor(toNum(opts.lands, 18)))
  const level = opts.level == null ? null : Math.max(1, Math.floor(toNum(opts.level, 1)))
  const top = Math.max(1, Math.floor(toNum(opts.top, 20)))
  const input = opts.input || DEFAULT_INPUT
  const inputAbs = resolve(input)
  const rawSeeds = readSeeds(inputAbs)
  const seedPhaseReduceMap = loadSeedPhaseReduceMap()
  const { rows, skipped, plantSecondsNoFert, plantSecondsNormalFert, missingPhaseReduceCount } = buildRows(
    rawSeeds,
    lands,
    seedPhaseReduceMap,
  )

  if (rows.length === 0) throw new Error('没有可计算的种子数据')

  const topNo = pickTop(rows, 'farmExpPerHourNoFert', top)
  const topFert = pickTop(rows, 'farmExpPerHourNormalFert', top)
  const bestByLevel = buildBestByLevel(rows)
  const currentLevel = level != null ? (bestByLevel.find((x) => x.level === level) ?? null) : null

  return {
    generatedAt: new Date().toISOString(),
    input: inputAbs,
    config: { lands, plantSecondsNoFert, plantSecondsNormalFert },
    stats: { rawCount: rawSeeds.length, calculatedCount: rows.length, skippedCount: skipped, missingPhaseReduceCount },
    topNoFert: topNo.map((r) => ({
      seedId: r.seedId,
      name: r.name,
      requiredLevel: r.requiredLevel,
      expPerHour: Number(r.farmExpPerHourNoFert.toFixed(4)),
    })),
    topNormalFert: topFert.map((r) => ({
      seedId: r.seedId,
      name: r.name,
      requiredLevel: r.requiredLevel,
      expPerHour: Number(r.farmExpPerHourNormalFert.toFixed(4)),
      gainPercent: Number(r.gainPercent.toFixed(4)),
    })),
    bestByLevel,
    currentLevel,
    rows,
  }
}

export function getPlantingRecommendation(level: number, lands?: number, opts: Partial<CliOpts> = {}) {
  const safeLevel = Math.max(1, Math.floor(toNum(level, 1)))
  const payload = analyzeExpYield({
    input: opts.input || DEFAULT_INPUT,
    lands: lands ?? 18,
    top: opts.top || 20,
    level: safeLevel,
  })

  const availableRows = payload.rows.filter((r) => r.requiredLevel <= safeLevel)
  const rankedNoFert = pickTop(availableRows, 'farmExpPerHourNoFert', opts.top || 20)
  const rankedNormalFert = pickTop(availableRows, 'farmExpPerHourNormalFert', opts.top || 20)

  const mapRow = (r: YieldRow, key: 'farmExpPerHourNoFert' | 'farmExpPerHourNormalFert') => ({
    seedId: r.seedId,
    name: r.name,
    requiredLevel: r.requiredLevel,
    expPerHour: Number(r[key].toFixed(4)),
  })

  return {
    level: safeLevel,
    lands: payload.config.lands,
    bestNoFert: rankedNoFert[0] ? mapRow(rankedNoFert[0], 'farmExpPerHourNoFert') : null,
    bestNormalFert: rankedNormalFert[0] ? mapRow(rankedNormalFert[0], 'farmExpPerHourNormalFert') : null,
    candidatesNoFert: rankedNoFert.map((r) => mapRow(r, 'farmExpPerHourNoFert')),
    candidatesNormalFert: rankedNormalFert.map((r) => mapRow(r, 'farmExpPerHourNormalFert')),
  }
}

// CLI entry point
if (import.meta.main) {
  try {
    const opts = parseArgs(process.argv.slice(2))
    const payload = analyzeExpYield(opts)
    const rows = payload.rows

    writeFileSync(resolve(opts.outJson), JSON.stringify(payload, null, 2), 'utf8')

    // CSV
    const csvHeaders = [
      'seedId',
      'name',
      'requiredLevel',
      'price',
      'expHarvest',
      'growTimeSec',
      'farmExpPerHourNoFert',
      'farmExpPerHourNormalFert',
      'gainPercent',
    ]
    const csvLines = [csvHeaders.join(','), ...rows.map((r) => csvHeaders.map((h) => csvCell((r as any)[h])).join(','))]
    writeFileSync(resolve(opts.outCsv), `${csvLines.join('\n')}\n`, 'utf8')

    // Summary
    const topNo = pickTop(rows, 'farmExpPerHourNoFert', opts.top)
    const lines = ['经验收益率分析结果', '', `地块数: ${opts.lands}`, '']
    lines.push(`Top ${topNo.length}（不施肥）`)
    for (const [i, r] of topNo.entries()) {
      lines.push(
        `${String(i + 1).padStart(2)} | ${r.name} | Lv${r.requiredLevel} | ${r.growTimeStr} | ${r.farmExpPerHourNoFert.toFixed(2)} exp/h`,
      )
    }
    if (payload.currentLevel) {
      lines.push(
        '',
        `Lv${opts.level} 最优(不施肥): ${payload.currentLevel.bestNoFert.name} ${payload.currentLevel.bestNoFert.expPerHour} exp/h`,
      )
      lines.push(
        `Lv${opts.level} 最优(普通肥): ${payload.currentLevel.bestNormalFert.name} ${payload.currentLevel.bestNormalFert.expPerHour} exp/h`,
      )
    }
    writeFileSync(resolve(opts.outTxt), `${lines.join('\n')}\n`, 'utf8')

    console.log(`[收益率] 计算完成，共 ${rows.length} 条`)
    console.log(`[收益率] JSON: ${resolve(opts.outJson)}`)
    console.log(`[收益率] CSV : ${resolve(opts.outCsv)}`)
  } catch (e: any) {
    console.error(`[收益率] 失败: ${e.message}`)
    process.exit(1)
  }
}
