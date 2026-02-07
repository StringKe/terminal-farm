import { Text } from 'ink'
import { PanelBox } from '../components/panel-box.js'

interface TaskPanelProps {
  tasks: any[]
}

export function TaskPanel({ tasks: _tasks }: TaskPanelProps) {
  return (
    <PanelBox title="任务">
      <Text dimColor>自动领取中</Text>
    </PanelBox>
  )
}
