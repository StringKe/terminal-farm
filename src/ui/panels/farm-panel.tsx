import { Box, Text } from 'ink'
import { PlantPhase } from '../../config/constants.js'
import { getPlantName } from '../../config/game-data.js'
import { toNum } from '../../utils/long.js'
import { getServerTimeSec, toTimeSec } from '../../utils/time.js'
import { PanelBox } from '../components/panel-box.js'
import { ProgressBar } from '../components/progress-bar.js'

interface FarmPanelProps {
  lands: any[]
}

export function FarmPanel({ lands }: FarmPanelProps) {
  const unlocked = lands.filter((l) => l?.unlocked)
  const planted = unlocked.filter((l) => l?.plant?.phases?.length > 0)

  return (
    <PanelBox title={`农场 (${planted.length}/${unlocked.length}块种植中)`}>
      {unlocked.slice(0, 12).map((land) => {
        const id = toNum(land.id)
        const plant = land.plant
        if (!plant?.phases?.length) {
          return (
            <Text key={id} dimColor>
              #{String(id).padStart(2, '0')} (空地)
            </Text>
          )
        }

        const name = getPlantName(toNum(plant.id)) || plant.name || '未知'
        const nowSec = getServerTimeSec()

        // Find current phase
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

        if (phaseVal === PlantPhase.MATURE) {
          return (
            <Box key={id}>
              <Text>
                #{String(id).padStart(2, '0')} {name}
                {'   '}
              </Text>
              <Text color="green" bold>
                收获!
              </Text>
            </Box>
          )
        }

        // Calculate progress
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
          if (secsLeft < 60) remaining = `${secsLeft}s`
          else if (secsLeft < 3600) remaining = `${Math.floor(secsLeft / 60)}m`
          else remaining = `${Math.floor(secsLeft / 3600)}h${Math.floor((secsLeft % 3600) / 60)}m`
        }

        return (
          <Box key={id}>
            <Text>
              #{String(id).padStart(2, '0')} {name.padEnd(6)}
            </Text>
            <ProgressBar current={Math.round(progress * 100)} total={100} width={8} />
            {remaining ? <Text dimColor> {remaining}</Text> : null}
          </Box>
        )
      })}
      {unlocked.length > 12 && <Text dimColor>... 还有 {unlocked.length - 12} 块</Text>}
    </PanelBox>
  )
}
