import { Box, Text } from 'ink'
import { useEffect, useState } from 'react'
import { getLevelExpProgress } from '../../config/game-data.js'
import type { UserState } from '../../protocol/types.js'
import type { SchedulerStatusInfo } from '../../store/session-store.js'
import { getChinaTimeStr, getLocalTimeStr } from '../../utils/format.js'
import { ProgressBar } from '../components/progress-bar.js'

function useClockTick(): { local: string; game: string } {
  const [tick, setTick] = useState(() => ({ local: getLocalTimeStr(), game: getChinaTimeStr() }))
  useEffect(() => {
    const timer = setInterval(() => {
      setTick({ local: getLocalTimeStr(), game: getChinaTimeStr() })
    }, 1000)
    return () => clearInterval(timer)
  }, [])
  return tick
}

interface StatusBarProps {
  user: UserState
  platform: 'qq' | 'wx'
  apiPort?: number
  schedulerStatus?: SchedulerStatusInfo | null
}

export function StatusBar({ user, platform, apiPort, schedulerStatus }: StatusBarProps) {
  const progress = getLevelExpProgress(user.level, user.exp)
  const clock = useClockTick()

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
      <Box gap={2}>
        <Text color={platform === 'wx' ? 'magenta' : 'cyan'} bold>
          {platform === 'wx' ? '微信' : 'QQ'}
        </Text>
        <Text bold>{user.name || '未登录'}</Text>
        {user.gid > 0 && <Text dimColor>({user.gid})</Text>}
        <Text color="green">Lv{user.level}</Text>
        <Text color="yellow">金币 {user.gold.toLocaleString()}</Text>
        <Box>
          <Text>经验 </Text>
          <ProgressBar current={progress.current} total={progress.needed} width={15} />
          <Text dimColor>
            {' '}
            ({progress.current}/{progress.needed})
          </Text>
        </Box>
      </Box>
      <Box gap={1}>
        {schedulerStatus?.resting ? (
          <Text color="yellow">[休息 {schedulerStatus.restSecondsLeft}s]</Text>
        ) : schedulerStatus ? (
          <Text dimColor>[拟人]</Text>
        ) : null}
        {apiPort ? <Text dimColor>API :{apiPort}</Text> : null}
        <Text dimColor>
          本机 {clock.local.slice(0, 5)} | 游戏 {clock.game.slice(0, 5)}
        </Text>
      </Box>
    </Box>
  )
}
