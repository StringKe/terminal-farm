import { Box, Text } from 'ink'
import type { LogEntry } from '../../utils/logger.js'
import { PanelBox } from '../components/panel-box.js'

interface LogPanelProps {
  logs: LogEntry[]
  maxLines?: number
}

export function LogPanel({ logs, maxLines = 10 }: LogPanelProps) {
  const displayLogs = logs.slice(-maxLines)

  return (
    <PanelBox title="日志">
      {displayLogs.length === 0 ? (
        <Text dimColor>无日志</Text>
      ) : (
        displayLogs.map((entry, i) => (
          <Box key={i}>
            <Text dimColor>{entry.timestamp} </Text>
            <Text color={entry.level === 'warn' ? 'yellow' : entry.level === 'error' ? 'red' : 'white'}>
              [{entry.tag.padEnd(4)}]
            </Text>
            <Text> {entry.message}</Text>
          </Box>
        ))
      )}
    </PanelBox>
  )
}
