import { Box, Text } from 'ink'
import { getLevelExpProgress } from '../../config/game-data.js'
import type { UserState } from '../../protocol/types.js'
import { ProgressBar } from '../components/progress-bar.js'

interface StatusBarProps {
  user: UserState
  platform: 'qq' | 'wx'
  apiPort?: number
}

export function StatusBar({ user, platform, apiPort }: StatusBarProps) {
  const progress = getLevelExpProgress(user.level, user.exp)

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
      <Box gap={2}>
        <Text color={platform === 'wx' ? 'magenta' : 'cyan'} bold>
          {platform === 'wx' ? '微信' : 'QQ'}
        </Text>
        <Text bold>{user.name || '未登录'}</Text>
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
      {apiPort ? <Text dimColor>API :{apiPort}</Text> : null}
    </Box>
  )
}
