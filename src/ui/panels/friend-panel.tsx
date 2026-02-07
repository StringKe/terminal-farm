import { Box, Text } from 'ink'
import { PanelBox } from '../components/panel-box.js'

interface FriendPanelProps {
  progress: { current: number; total: number }
  stats: { steal: number; weed: number; bug: number; water: number }
}

export function FriendPanel({ progress, stats }: FriendPanelProps) {
  return (
    <PanelBox title={`好友巡查 (${progress.current}/${progress.total})`}>
      <Box gap={2}>
        <Text>
          今日 帮:{stats.weed + stats.bug + stats.water} 偷:{stats.steal}
        </Text>
      </Box>
    </PanelBox>
  )
}
