import { Box, Text } from 'ink'

const HINTS = [
  { key: '←→/Tab', desc: '账号' },
  { key: '+', desc: '添加' },
  { key: 'S', desc: '设置' },
  { key: '↑↓', desc: '日志' },
  { key: '[]', desc: '统计' },
  { key: 'Q/^C', desc: '退出' },
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
