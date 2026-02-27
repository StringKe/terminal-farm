import { Box, Text } from 'ink'
import type { LogEntry } from '../../utils/logger.js'
import { PanelBox } from '../components/panel-box.js'
import { useGlobalLogs } from '../hooks/use-store.js'

function LogEntryRow({ entry }: { entry: LogEntry }) {
  return (
    <Box>
      <Text dimColor>{entry.timestamp} </Text>
      {entry.accountLabel && <Text color="magenta">[{entry.accountLabel}] </Text>}
      <Text color={entry.level === 'warn' ? 'yellow' : entry.level === 'error' ? 'red' : 'white'}>
        [{entry.tag.padEnd(4)}]
      </Text>
      <Text> {entry.message}</Text>
    </Box>
  )
}

interface GlobalLogPanelProps {
  scrollOffset?: number
  maxLines?: number
}

export function GlobalLogPanel({ scrollOffset = 0, maxLines = 10 }: GlobalLogPanelProps) {
  const logs = useGlobalLogs()

  const end = logs.length - scrollOffset
  const start = Math.max(0, end - maxLines)
  const displayLogs = logs.slice(start, Math.max(end, 0))

  return (
    <PanelBox title="日志">
      {scrollOffset > 0 && <Text dimColor>↑ 更早日志</Text>}
      {displayLogs.length === 0 ? (
        <Text dimColor>无日志</Text>
      ) : (
        displayLogs.map((entry, i) => <LogEntryRow key={i} entry={entry} />)
      )}
    </PanelBox>
  )
}
