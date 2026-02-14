import { Box, Text, useInput } from 'ink'
import { useState } from 'react'
import { PanelBox } from '../components/panel-box.js'

interface LoginScreenProps {
  onLoginQR: () => void
  onLoginCode: (platform: 'qq' | 'wx', code: string) => void
  isLoading: boolean
  error: string | null
  qrText?: string | null
  qrUrl?: string | null
}

type Mode = 'menu' | 'input-code' | 'qr-scan'

export function LoginScreen({ onLoginQR, onLoginCode, isLoading, error, qrText, qrUrl }: LoginScreenProps) {
  const [mode, setMode] = useState<Mode>('menu')
  const [selected, setSelected] = useState(0)
  const [codeInput, setCodeInput] = useState('')
  const [platform, setPlatform] = useState<'qq' | 'wx'>('qq')

  const menuItems = [
    { label: 'QQ 扫码登录', action: () => onLoginQR() },
    {
      label: 'QQ Code 登录',
      action: () => {
        setPlatform('qq')
        setMode('input-code')
      },
    },
    {
      label: '微信 Code 登录',
      action: () => {
        setPlatform('wx')
        setMode('input-code')
      },
    },
  ]

  // Switch to qr-scan mode when qrText arrives
  const effectiveMode = qrText ? 'qr-scan' : mode

  useInput((input, key) => {
    if (isLoading && !qrText) return

    if (effectiveMode === 'qr-scan') {
      // In QR scan mode, no interaction needed (waiting for scan)
      return
    }

    if (effectiveMode === 'menu') {
      if (key.upArrow) setSelected((s) => Math.max(0, s - 1))
      if (key.downArrow) setSelected((s) => Math.min(menuItems.length - 1, s + 1))
      if (key.return) menuItems[selected].action()
      return
    }

    if (effectiveMode === 'input-code') {
      if (key.escape) {
        setMode('menu')
        setCodeInput('')
        return
      }
      if (key.return && codeInput.trim()) {
        onLoginCode(platform, codeInput.trim())
        return
      }
      if (key.backspace || key.delete) {
        setCodeInput((c) => c.slice(0, -1))
        return
      }
      if (input && !key.ctrl && !key.meta) {
        setCodeInput((c) => c + input)
      }
    }
  })

  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" minHeight={16}>
      <Box marginBottom={1}>
        <Text bold color="green">
          {'  '}terminal-farm{'  '}
        </Text>
      </Box>

      {error && (
        <Box marginBottom={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}

      {isLoading && !qrText ? (
        <PanelBox title="登录中">
          <Text>连接服务器中，请稍候...</Text>
        </PanelBox>
      ) : effectiveMode === 'qr-scan' ? (
        <PanelBox title="QQ 扫码登录">
          <Text>{qrText}</Text>
          {qrUrl && (
            <Box marginTop={1}>
              <Text dimColor>若二维码显示异常，可打开链接:</Text>
            </Box>
          )}
          {qrUrl && (
            <Text
              dimColor
            >{`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}`}</Text>
          )}
          <Box marginTop={1}>
            <Text color="yellow">等待扫码...</Text>
          </Box>
        </PanelBox>
      ) : effectiveMode === 'menu' ? (
        <PanelBox title="选择登录方式">
          {menuItems.map((item, i) => (
            <Text key={item.label}>
              {i === selected ? <Text color="cyan"> {'>'} </Text> : <Text> </Text>}
              {item.label}
            </Text>
          ))}
          <Box marginTop={1}>
            <Text dimColor>↑↓ 选择 Enter 确认</Text>
          </Box>
        </PanelBox>
      ) : (
        <PanelBox title={`输入 ${platform.toUpperCase()} Code`}>
          <Box>
            <Text>Code: </Text>
            <Text color="cyan">{codeInput}</Text>
            <Text color="cyan">_</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Enter 确认 Esc 返回</Text>
          </Box>
        </PanelBox>
      )}
    </Box>
  )
}
