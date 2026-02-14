import { Box, Text } from 'ink'
import { useEffect, useState } from 'react'
import type { LogEntry } from '../../utils/logger.js'
import { PanelBox } from '../components/panel-box.js'
import { useGlobalLogs } from '../hooks/use-store.js'

function useCurrentTime(): string {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('zh-CN', { hour12: false }))
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('zh-CN', { hour12: false }))
    }, 1000)
    return () => clearInterval(timer)
  }, [])
  return time
}

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

interface GlobalLogPanelProps {
  scrollOffset?: number
  maxLines?: number
}

export function GlobalLogPanel({ scrollOffset = 0, maxLines = 10 }: GlobalLogPanelProps) {
  const logs = useGlobalLogs()
  const currentTime = useCurrentTime()

  const end = logs.length - scrollOffset
  const start = Math.max(0, end - maxLines)
  const displayLogs = logs.slice(start, Math.max(end, 0))

  return (
    <PanelBox title={`日志 ${currentTime}`}>
      {scrollOffset > 0 && <Text dimColor>↑ 更早日志</Text>}
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
