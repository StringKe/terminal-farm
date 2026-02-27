import { Box, Text } from 'ink'
import type { FriendInfo } from '../../store/session-store.js'
import { type DailyStats, STATS_VIEW_LABELS, type StatsViewMode, aggregateStats } from '../../store/stats.js'
import { chunk } from '../../utils/array.js'
import { padEndCJK } from '../../utils/string-width.js'
import { PanelBox } from '../components/panel-box.js'

const ACTIVE_COL_WIDTH = 32
const INACTIVE_COL_WIDTH = 14

interface FriendPanelProps {
  progress: { current: number; total: number }
  friendTotal: number
  dailyStats: DailyStats
  statsViewMode: StatsViewMode
  friendList: FriendInfo[]
  columns?: number
}

export function FriendPanel({
  progress,
  friendTotal,
  dailyStats,
  statsViewMode,
  friendList,
  columns = 80,
}: FriendPanelProps) {
  const patrolStr = progress.total > 0 ? `巡查 ${progress.current}/${progress.total}` : '待巡查'

  const active = friendList.filter((f) => f.actions.length > 0)
  const inactive = friendList.filter((f) => f.actions.length === 0)

  const innerWidth = Math.max(40, columns - 4)
  const activeCols = Math.max(1, Math.floor(innerWidth / ACTIVE_COL_WIDTH))
  const inactiveCols = Math.max(1, Math.floor(innerWidth / INACTIVE_COL_WIDTH))

  const maxActiveRows = 4
  const maxActiveDisplay = activeCols * maxActiveRows
  const displayActive = active.slice(0, maxActiveDisplay)
  const activeRows = chunk(displayActive, activeCols)

  const maxInactiveRows = 2
  const maxInactiveDisplay = inactiveCols * maxInactiveRows
  const displayInactive = inactive.slice(0, maxInactiveDisplay)
  const inactiveRows = chunk(displayInactive, inactiveCols)

  const viewStats = statsViewMode === 'today' ? dailyStats : aggregateStats(statsViewMode, dailyStats)
  const viewLabel = STATS_VIEW_LABELS[statsViewMode]

  return (
    <PanelBox title={`好友 (${friendTotal}人) ${patrolStr}`}>
      <Box flexDirection="column">
        <Box>
          <Text>
            <Text dimColor>自家</Text>
            {'  '}
            <Text color="yellow">草{viewStats.farmWeed}</Text> <Text color="magenta">虫{viewStats.farmBug}</Text>{' '}
            <Text color="cyan">水{viewStats.farmWater}</Text> <Text color="green">收{viewStats.farmHarvest}</Text>{' '}
            <Text color="blue">种{viewStats.farmPlant}</Text> <Text color="white">肥{viewStats.farmFertilize}</Text>
          </Text>
        </Box>
        <Box justifyContent="space-between">
          <Text>
            <Text dimColor>好友</Text>
            {'  '}
            <Text color="yellow">草{viewStats.friendWeed}</Text> <Text color="magenta">虫{viewStats.friendBug}</Text>{' '}
            <Text color="cyan">水{viewStats.friendWater}</Text> <Text color="red">偷{viewStats.friendSteal}</Text>{' '}
            <Text color="yellow" dimColor>
              放草{viewStats.friendPutWeed}
            </Text>{' '}
            <Text color="magenta" dimColor>
              放虫{viewStats.friendPutBug}
            </Text>
          </Text>
          <Text dimColor>
            {'◀'} {viewLabel} {'▶'}
          </Text>
        </Box>
      </Box>
      {activeRows.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>-- 本轮操作 ({active.length}人) --</Text>
          {activeRows.map((row, ri) => (
            <Box key={ri}>
              {row.map((f, fi) => (
                <Box key={`${f.gid}-${fi}`} width={ACTIVE_COL_WIDTH}>
                  <Text>
                    {padEndCJK(f.name, 8)} <Text dimColor>Lv{String(f.level).padEnd(3)}</Text>
                    <Text color="green">{f.actions.join('/')}</Text>
                  </Text>
                </Box>
              ))}
            </Box>
          ))}
          {active.length > maxActiveDisplay && (
            <Text dimColor>... 还有 {active.length - maxActiveDisplay} 人有操作</Text>
          )}
        </Box>
      )}
      {inactiveRows.length > 0 && (
        <Box flexDirection="column" marginTop={activeRows.length > 0 ? 1 : 0}>
          <Text dimColor>-- 未操作 ({inactive.length}人) --</Text>
          {inactiveRows.map((row, ri) => (
            <Box key={ri}>
              {row.map((f, fi) => (
                <Box key={`${f.gid}-${fi}`} width={INACTIVE_COL_WIDTH}>
                  <Text dimColor>{padEndCJK(f.name, 12)}</Text>
                </Box>
              ))}
            </Box>
          ))}
          {inactive.length > maxInactiveDisplay && (
            <Text dimColor>... 还有 {inactive.length - maxInactiveDisplay} 人</Text>
          )}
        </Box>
      )}
    </PanelBox>
  )
}
