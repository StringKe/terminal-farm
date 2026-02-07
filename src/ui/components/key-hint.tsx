import { Box, Text } from 'ink'

const HINTS = [
  { key: 'Tab', desc: '账号' },
  { key: 'F', desc: '农场' },
  { key: 'B', desc: '背包' },
  { key: 'T', desc: '任务' },
  { key: 'L', desc: '日志' },
  { key: 'Q', desc: '退出' },
]

export function KeyHint() {
  return (
    <Box>
      {HINTS.map((h, i) => (
        <Box key={h.key} marginRight={1}>
          <Text bold color="yellow">
            {h.key}
          </Text>
          <Text dimColor>:{h.desc}</Text>
          {i < HINTS.length - 1 && <Text dimColor> </Text>}
        </Box>
      ))}
    </Box>
  )
}
