import { Box, Text } from 'ink'
import { useMemo } from 'react'
import { getPlantingRecommendation } from '../../core/exp-calculator.js'
import { PanelBox } from '../components/panel-box.js'

interface CalculatorScreenProps {
  level: number
  lands: number
}

export function CalculatorScreen({ level, lands }: CalculatorScreenProps) {
  const candidates = useMemo(() => {
    try {
      const rec = getPlantingRecommendation(level, lands, { top: 20 })
      return rec.candidatesNormalFert || []
    } catch {
      return []
    }
  }, [level, lands])

  return (
    <Box flexDirection="column" padding={1}>
      <PanelBox title={`经验效率计算器 (Lv${level}, ${lands}块地)`}>
        <Box>
          <Text bold>{'排名'.padEnd(6)}</Text>
          <Text bold>{'作物'.padEnd(12)}</Text>
          <Text bold>{'等级'.padEnd(8)}</Text>
          <Text bold>{'经验/时'.padEnd(12)}</Text>
        </Box>
        {candidates.slice(0, 20).map((c, i) => (
          <Box key={c.seedId}>
            <Text color={i === 0 ? 'green' : i < 3 ? 'yellow' : undefined}>{`#${i + 1}`.padEnd(6)}</Text>
            <Text>{c.name.padEnd(12)}</Text>
            <Text>{`Lv${c.requiredLevel}`.padEnd(8)}</Text>
            <Text>{c.expPerHour.toFixed(1)}</Text>
          </Box>
        ))}
        {candidates.length === 0 && <Text dimColor>无可用作物数据</Text>}
      </PanelBox>
    </Box>
  )
}
