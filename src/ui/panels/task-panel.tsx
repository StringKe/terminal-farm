import { Text } from 'ink'
import type { TaskInfo } from '../../store/session-store.js'
import { PanelBox } from '../components/panel-box.js'

interface TaskPanelProps {
  tasks: TaskInfo[]
}

export function TaskPanel({ tasks }: TaskPanelProps) {
  const claimable = tasks.filter(
    (t) => t.isUnlocked && !t.isClaimed && t.progress >= t.totalProgress && t.totalProgress > 0,
  )
  const completed = tasks.filter((t) => t.isClaimed)
  const total = tasks.length

  return (
    <PanelBox title="任务">
      {total === 0 ? (
        <Text dimColor>自动领取中</Text>
      ) : (
        <>
          <Text>
            <Text color="green">可领 {claimable.length}</Text>
            {' / '}
            <Text dimColor>已完成 {completed.length}</Text>
            {' / '}共{total}
          </Text>
          {claimable.slice(0, 3).map((t, i) => (
            <Text key={`${t.id}-${i}`} color="yellow">
              → {t.desc}
            </Text>
          ))}
        </>
      )}
    </PanelBox>
  )
}
