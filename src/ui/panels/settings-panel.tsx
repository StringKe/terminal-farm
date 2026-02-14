import { Box, Text, useInput } from 'ink'
import { useState } from 'react'
import type { AccountConfig } from '../../config/schema.js'
import { PanelBox } from '../components/panel-box.js'

type ConfigKey = keyof AccountConfig

interface SettingItem {
  key: ConfigKey
  label: string
  type: 'boolean' | 'number' | 'enum'
  enumValues?: (string | false)[]
  step?: number
  min?: number
  max?: number
}

const SETTINGS: SettingItem[] = [
  { key: 'manualSeedId', label: '手动种子ID (0=自动)', type: 'number', step: 1, min: 0, max: 99999 },
  { key: 'forceLowestLevelCrop', label: '强制最低等级作物', type: 'boolean' },
  { key: 'autoReplantMode', label: '换种模式', type: 'enum', enumValues: ['levelup', 'always', false] },
  { key: 'replantProtectPercent', label: '换种保护%', type: 'number', step: 5, min: 0, max: 100 },
  { key: 'useOrganicFertilizer', label: '有机肥料', type: 'boolean' },
  { key: 'autoRefillFertilizer', label: '自动补充肥料', type: 'boolean' },
  { key: 'enablePutBadThings', label: '放虫放草', type: 'boolean' },
  { key: 'autoClaimFreeGifts', label: '自动领礼包', type: 'boolean' },
]

interface SettingsPanelProps {
  accountConfig: AccountConfig
  onUpdate: (partial: Partial<AccountConfig>) => void
  onClose: () => void
}

function formatValue(item: SettingItem, value: unknown): string {
  if (item.type === 'boolean') return value ? 'ON' : 'OFF'
  if (item.type === 'enum') {
    if (value === false) return '关闭'
    if (value === 'levelup') return '升级时'
    if (value === 'always') return '始终'
    return String(value)
  }
  return String(value)
}

export function SettingsPanel({ accountConfig, onUpdate, onClose }: SettingsPanelProps) {
  const [cursor, setCursor] = useState(0)

  useInput((input, key) => {
    if (input === 's' || key.escape) {
      onClose()
      return
    }
    if (key.upArrow) {
      setCursor((c) => (c - 1 + SETTINGS.length) % SETTINGS.length)
      return
    }
    if (key.downArrow) {
      setCursor((c) => (c + 1) % SETTINGS.length)
      return
    }

    const item = SETTINGS[cursor]
    if (!item) return

    if (item.type === 'boolean' && (input === ' ' || key.return)) {
      onUpdate({ [item.key]: !accountConfig[item.key] })
      return
    }

    if (item.type === 'enum' && (input === ' ' || key.return || key.rightArrow || key.leftArrow)) {
      const values = item.enumValues!
      const currentIdx = values.indexOf(accountConfig[item.key] as string | false)
      const dir = key.leftArrow ? -1 : 1
      const nextIdx = (currentIdx + dir + values.length) % values.length
      onUpdate({ [item.key]: values[nextIdx] })
      return
    }

    if (item.type === 'number') {
      const step = item.step ?? 1
      const current = accountConfig[item.key] as number
      if (key.rightArrow || input === ' ' || key.return) {
        const next = Math.min(current + step, item.max ?? Number.MAX_SAFE_INTEGER)
        onUpdate({ [item.key]: next })
      } else if (key.leftArrow) {
        const next = Math.max(current - step, item.min ?? 0)
        onUpdate({ [item.key]: next })
      }
    }
  })

  return (
    <PanelBox title="设置 (S:关闭 ↑↓:选择 ←→/Enter:修改)" borderColor="yellow">
      {SETTINGS.map((item, i) => {
        const selected = i === cursor
        const value = accountConfig[item.key]
        const display = formatValue(item, value)
        const isOn = item.type === 'boolean' && value === true

        return (
          <Box key={item.key}>
            <Text color={selected ? 'yellow' : undefined} bold={selected}>
              {selected ? '▸ ' : '  '}
              {item.label}:{' '}
            </Text>
            <Text color={isOn ? 'green' : item.type === 'boolean' && !value ? 'red' : 'white'} bold={selected}>
              {display}
            </Text>
          </Box>
        )
      })}
    </PanelBox>
  )
}
