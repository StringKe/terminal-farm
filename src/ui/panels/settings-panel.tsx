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
  { key: 'useNormalFertilizer', label: '普通肥料', type: 'boolean' },
  { key: 'autoRefillNormalFertilizer', label: '自动补充普通肥料', type: 'boolean' },
  { key: 'useOrganicFertilizer', label: '有机肥料', type: 'boolean' },
  { key: 'autoRefillOrganicFertilizer', label: '自动补充有机肥料', type: 'boolean' },
  { key: 'enableFriendSteal', label: '偷好友菜', type: 'boolean' },
  { key: 'enableFriendHelp', label: '帮好友(除草/除虫/浇水)', type: 'boolean' },
  { key: 'helpOnlyWithExp', label: '帮好友仅限有经验', type: 'boolean' },
  { key: 'enablePutBadThings', label: '放虫放草', type: 'boolean' },
  { key: 'autoClaimFreeGifts', label: '自动领礼包', type: 'boolean' },
  { key: 'autoUseGiftPacks', label: '自动开礼包', type: 'boolean' },
  { key: 'enableHumanMode', label: '拟人模式', type: 'boolean' },
  { key: 'humanModeIntensity', label: '拟人强度', type: 'enum', enumValues: ['low', 'medium', 'high'] },
  { key: 'enableIllustratedUnlock', label: '图鉴解锁模式', type: 'boolean' },
]

interface SettingsPanelProps {
  accountConfig: AccountConfig
  onUpdate: (partial: Partial<AccountConfig>) => void
  onClose: () => void
}

const ENUM_LABELS: Record<string, string> = {
  levelup: '升级时',
  always: '始终',
  low: '低',
  medium: '中',
  high: '高',
}

function formatValue(item: SettingItem, value: unknown): string {
  if (item.type === 'boolean') return value ? 'ON' : 'OFF'
  if (item.type === 'enum') {
    if (value === false) return '关闭'
    return ENUM_LABELS[String(value)] ?? String(value)
  }
  return String(value)
}

export function SettingsPanel({ accountConfig, onUpdate, onClose }: SettingsPanelProps) {
  const [cursor, setCursor] = useState(0)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editBuffer, setEditBuffer] = useState('')

  useInput((input, key) => {
    // === Edit mode (number field) ===
    if (editingIndex !== null) {
      const item = SETTINGS[editingIndex]
      if (!item) return

      if (input >= '0' && input <= '9') {
        setEditBuffer((b) => b + input)
        return
      }

      if (key.backspace || key.delete) {
        setEditBuffer((b) => b.slice(0, -1))
        return
      }

      if (key.return) {
        const num = editBuffer === '' ? 0 : Number.parseInt(editBuffer, 10)
        const clamped = Math.max(item.min ?? 0, Math.min(num, item.max ?? Number.MAX_SAFE_INTEGER))
        onUpdate({ [item.key]: clamped })
        setEditingIndex(null)
        setEditBuffer('')
        return
      }

      if (key.escape) {
        setEditingIndex(null)
        setEditBuffer('')
        return
      }

      return
    }

    // === Navigation mode ===

    if (input.toLowerCase() === 's' || key.escape) {
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
      if (key.return || input === ' ') {
        setEditingIndex(cursor)
        setEditBuffer(String(accountConfig[item.key] as number))
        return
      }
      const step = item.step ?? 1
      const current = accountConfig[item.key] as number
      if (key.rightArrow) {
        onUpdate({ [item.key]: Math.min(current + step, item.max ?? Number.MAX_SAFE_INTEGER) })
      } else if (key.leftArrow) {
        onUpdate({ [item.key]: Math.max(current - step, item.min ?? 0) })
      }
    }
  })

  const isEditing = editingIndex !== null
  const title = isEditing ? '设置 [编辑中: Enter确认 Esc取消]' : '设置 (S:关闭 ↑↓:选 Enter:改)'

  return (
    <PanelBox title={title} borderColor="yellow">
      {SETTINGS.map((item, i) => {
        const selected = i === cursor
        const value = accountConfig[item.key]
        const editing = editingIndex === i

        if (editing) {
          return (
            <Box key={item.key}>
              <Text color="yellow" bold>
                {'▸ '}
                {item.label}:{' '}
              </Text>
              <Text color="black" backgroundColor="yellow" bold>
                {editBuffer}▏
              </Text>
            </Box>
          )
        }

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
