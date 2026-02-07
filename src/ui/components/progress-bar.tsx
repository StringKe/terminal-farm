import { Text } from 'ink'

interface ProgressBarProps {
  current: number
  total: number
  width?: number
  filledChar?: string
  emptyChar?: string
  color?: string
}

export function ProgressBar({
  current,
  total,
  width = 20,
  filledChar = '█',
  emptyChar = '░',
  color = 'green',
}: ProgressBarProps) {
  const percent = total > 0 ? Math.min(1, current / total) : 0
  const filled = Math.round(percent * width)
  const empty = width - filled
  const percentStr = `${Math.round(percent * 100)}%`

  return (
    <Text>
      <Text color={color}>{filledChar.repeat(filled)}</Text>
      <Text dimColor>{emptyChar.repeat(empty)}</Text>
      <Text> {percentStr}</Text>
    </Text>
  )
}
