import { Text } from 'ink'
import { getItemName } from '../../config/game-data.js'
import { toNum } from '../../utils/long.js'
import { padEndCJK } from '../../utils/string-width.js'
import { PanelBox } from '../components/panel-box.js'

interface BagPanelProps {
  items: any[]
}

export function BagPanel({ items }: BagPanelProps) {
  const displayItems = items.filter((i) => toNum(i.count) > 0).slice(0, 10)

  return (
    <PanelBox title="背包">
      {displayItems.length === 0 ? (
        <Text dimColor>空</Text>
      ) : (
        displayItems.map((item, idx) => {
          const id = toNum(item.id)
          const count = toNum(item.count)
          return (
            <Text key={idx}>
              {padEndCJK(getItemName(id), 12)} x{count.toLocaleString()}
            </Text>
          )
        })
      )}
      {items.length > 10 && <Text dimColor>... 还有 {items.length - 10} 种</Text>}
    </PanelBox>
  )
}
