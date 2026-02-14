import { Box, Text } from 'ink'
import { LAND_LEVEL_COLORS, LAND_LEVEL_NAMES, PlantPhase } from '../../config/constants.js'
import { getPlantName } from '../../config/game-data.js'
import { toNum } from '../../utils/long.js'
import { getServerTimeSec, toTimeSec } from '../../utils/time.js'
import { PanelBox } from '../components/panel-box.js'

const COLS = 4
const BAR_WIDTH = 12
const TILE_HEIGHT = 4

function formatRemaining(secsLeft: number): string {
  if (secsLeft < 60) return `${secsLeft}s`
  if (secsLeft < 3600) return `${Math.floor(secsLeft / 60)}m`
  return `${Math.floor(secsLeft / 3600)}h${Math.floor((secsLeft % 3600) / 60)}m`
}

function renderBar(progress: number): string {
  const filled = Math.round(progress * BAR_WIDTH)
  return '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled)
}

interface LandTileProps {
  land: any
}

function LandTile({ land }: LandTileProps) {
  const id = toNum(land.id)
  const level = toNum(land.level)
  const prefix = `#${String(id).padStart(2, '0')}`
  const levelName = LAND_LEVEL_NAMES[level] || `L${level}`
  const levelColor = LAND_LEVEL_COLORS[level] || 'white'
  const plant = land.plant

  // 空地: 4行，只有前两行有内容
  if (!plant?.phases?.length) {
    return (
      <Box flexDirection="column" flexGrow={1} flexBasis={0} height={TILE_HEIGHT}>
        <Text>
          {prefix} <Text color={levelColor}>{levelName}</Text>
        </Text>
        <Text dimColor>(空地)</Text>
      </Box>
    )
  }

  const name = getPlantName(toNum(plant.id)) || plant.name || '未知'
  const nowSec = getServerTimeSec()

  // 状态收集
  const dryNum = toNum(plant.dry_num)
  const hasWeed = plant.weed_owners?.length > 0
  const hasBug = plant.insect_owners?.length > 0
  const hasMutant = plant.mutant_config_ids?.length > 0
  const stoleNum = toNum(plant.stole_num)
  const fruitTotal = toNum(plant.fruit_num)
  const fruitLeft = toNum(plant.left_fruit_num)
  const stolen = fruitTotal - fruitLeft
  const stealers = plant.stealers?.length || 0

  let currentPhase: any = null
  for (let i = plant.phases.length - 1; i >= 0; i--) {
    const bt = toTimeSec(plant.phases[i].begin_time)
    if (bt > 0 && bt <= nowSec) {
      currentPhase = plant.phases[i]
      break
    }
  }
  if (!currentPhase) currentPhase = plant.phases[0]
  const phaseVal = currentPhase?.phase ?? 0

  // Line 1: #01 黑土 黄豆
  const line1 = (
    <Text>
      {prefix} <Text color={levelColor}>{levelName}</Text> {name}
    </Text>
  )

  // Line 3: 异常状态
  const statusParts: React.ReactNode[] = []
  if (dryNum > 0)
    statusParts.push(
      <Text key="dry" color="yellow">
        缺水x{dryNum}
      </Text>,
    )
  if (hasWeed)
    statusParts.push(
      <Text key="weed" color="green">
        有草
      </Text>,
    )
  if (hasBug)
    statusParts.push(
      <Text key="bug" color="red">
        有虫
      </Text>,
    )
  if (hasMutant)
    statusParts.push(
      <Text key="mut" color="magenta">
        变异
      </Text>,
    )

  // Line 4: 偷菜/果实信息
  const infoParts: React.ReactNode[] = []
  if (stolen > 0)
    infoParts.push(
      <Text key="stolen" color="red">
        被偷-{stolen}
      </Text>,
    )
  if (stoleNum > 0 && stealers > 0)
    infoParts.push(
      <Text key="stealers" dimColor>
        {stealers}人偷过
      </Text>,
    )
  if (fruitLeft > 0 && phaseVal === PlantPhase.MATURE)
    infoParts.push(
      <Text key="fruit" dimColor>
        剩{fruitLeft}
      </Text>,
    )

  const line3 = statusParts.length > 0 ? <Text>{joinNodes(statusParts, ' ')}</Text> : <Text> </Text>
  const line4 = infoParts.length > 0 ? <Text>{joinNodes(infoParts, ' ')}</Text> : <Text> </Text>

  if (phaseVal === PlantPhase.MATURE) {
    return (
      <Box flexDirection="column" flexGrow={1} flexBasis={0} height={TILE_HEIGHT}>
        {line1}
        <Text>
          <Text color="green" bold>
            ★ 可收获
          </Text>
          {stolen > 0 ? <Text color="red"> (-{stolen})</Text> : null}
        </Text>
        {line3}
        {line4}
      </Box>
    )
  }

  if (phaseVal === PlantPhase.DEAD) {
    return (
      <Box flexDirection="column" flexGrow={1} flexBasis={0} height={TILE_HEIGHT}>
        {line1}
        <Text color="red">✕ 已枯死</Text>
        {line3}
        {line4}
      </Box>
    )
  }

  // 生长中
  const firstBegin = toTimeSec(plant.phases[0]?.begin_time)
  let matureBegin = 0
  for (const p of plant.phases) {
    if (p.phase === PlantPhase.MATURE) {
      matureBegin = toTimeSec(p.begin_time)
      break
    }
  }
  let progress = 0
  let remaining = ''
  if (matureBegin > firstBegin && firstBegin > 0) {
    progress = Math.min(1, (nowSec - firstBegin) / (matureBegin - firstBegin))
    const secsLeft = Math.max(0, matureBegin - nowSec)
    remaining = formatRemaining(secsLeft)
  }
  const pct = Math.round(progress * 100)

  return (
    <Box flexDirection="column" flexGrow={1} flexBasis={0} height={TILE_HEIGHT}>
      {line1}
      <Text>
        <Text color="green">{renderBar(progress)}</Text> {`${pct}%`.padStart(4)}
      </Text>
      <Text>
        剩余 {remaining || '--'}
        {statusParts.length > 0 ? <Text> {joinNodes(statusParts, ' ')}</Text> : null}
      </Text>
      {line4}
    </Box>
  )
}

/** 用分隔符连接 ReactNode 数组 */
function joinNodes(nodes: React.ReactNode[], sep: string): React.ReactNode[] {
  const result: React.ReactNode[] = []
  for (let i = 0; i < nodes.length; i++) {
    if (i > 0) result.push(sep)
    result.push(nodes[i])
  }
  return result
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}

interface FarmPanelProps {
  lands: any[]
  flexGrow?: number
}

export function FarmPanel({ lands, flexGrow }: FarmPanelProps) {
  const unlocked = lands.filter((l) => l?.unlocked).sort((a, b) => toNum(a.id) - toNum(b.id))
  const planted = unlocked.filter((l) => l?.plant?.phases?.length > 0)
  const total = lands.length

  const title =
    planted.length === unlocked.length
      ? `农场 (${unlocked.length}/${total}块全部种植中)`
      : `农场 (${planted.length}/${unlocked.length}块种植中, 共${total}块)`

  const rows = chunk(unlocked, COLS)

  return (
    <PanelBox title={title} flexGrow={flexGrow}>
      {rows.map((row, ri) => (
        <Box key={ri} gap={2}>
          {row.map((land) => (
            <LandTile key={toNum(land.id)} land={land} />
          ))}
        </Box>
      ))}
    </PanelBox>
  )
}
