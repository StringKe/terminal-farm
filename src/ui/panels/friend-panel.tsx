import { Box, Text } from 'ink'
import type { FriendInfo } from '../../store/session-store.js'
import { padEndCJK } from '../../utils/string-width.js'
import { PanelBox } from '../components/panel-box.js'

const FRIEND_COL_WIDTH = 24

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}

interface FriendPanelProps {
  progress: { current: number; total: number }
  friendTotal: number
  stats: { steal: number; weed: number; bug: number; water: number }
  friendList: FriendInfo[]
  columns?: number
}

export function FriendPanel({ progress, friendTotal, stats, friendList, columns = 80 }: FriendPanelProps) {
  const helpTotal = stats.weed + stats.bug + stats.water
  const patrolStr = progress.total > 0 ? `巡查 ${progress.current}/${progress.total}` : '待巡查'

  // 根据可用宽度计算列数，每列 FRIEND_COL_WIDTH 字符
  const cols = Math.max(1, Math.floor((columns - 4) / FRIEND_COL_WIDTH))
  const maxDisplay = cols * 4
  const displayFriends = friendList.slice(0, maxDisplay)

  const rows = chunk(displayFriends, cols)

  return (
    <PanelBox title={`好友 (${friendTotal}人) ${patrolStr}`}>
      <Box gap={2}>
        <Text>
          今日 <Text color="yellow">除草{stats.weed}</Text> <Text color="magenta">除虫{stats.bug}</Text>{' '}
          <Text color="cyan">浇水{stats.water}</Text> <Text color="red">偷菜{stats.steal}</Text>
          {'  '}
          <Text dimColor>帮:{helpTotal}</Text>
        </Text>
      </Box>
      {rows.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {rows.map((row, ri) => (
            <Box key={ri}>
              {row.map((f, fi) => (
                <Box key={`${f.gid}-${fi}`} width={FRIEND_COL_WIDTH}>
                  <Text>
                    {padEndCJK(f.name, 10)} <Text dimColor>Lv{f.level}</Text>
                  </Text>
                </Box>
              ))}
            </Box>
          ))}
          {friendList.length > maxDisplay && <Text dimColor>... 还有 {friendList.length - maxDisplay} 人</Text>}
        </Box>
      )}
    </PanelBox>
  )
}
