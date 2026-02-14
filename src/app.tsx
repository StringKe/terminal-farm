import { Box, useApp, useInput } from 'ink'
import { useCallback, useEffect, useState } from 'react'
import { loadConfigs } from './config/game-data.js'
import { config, updateConfig } from './config/index.js'
import { addAccount, autoLogin, loginWithQR, stopAll } from './core/account.js'
import { loadProto } from './protocol/proto-loader.js'
import { accountStore, getSessionStore } from './store/index.js'
import { KeyHint } from './ui/components/key-hint.js'
import { GlobalLogPanel } from './ui/panels/log-panel.js'
import { Dashboard } from './ui/screens/dashboard.js'
import { LoginScreen } from './ui/screens/login.js'
import { log } from './utils/logger.js'

type Screen = 'login' | 'dashboard'

interface AppProps {
  cliCode?: string
  cliPlatform?: 'qq' | 'wx'
}

export function App({ cliCode, cliPlatform }: AppProps) {
  const { exit } = useApp()
  const [screen, setScreen] = useState<Screen>('login')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [qrText, setQrText] = useState<string | null>(null)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [logScroll, setLogScroll] = useState(0)

  // Global Ctrl+C handler
  const handleQuit = useCallback(() => {
    stopAll()
    exit()
  }, [exit])

  useInput((_input, key) => {
    if (key.ctrl && _input === 'c') {
      handleQuit()
    }
  })

  const handleScrollLog = useCallback((delta: number) => {
    setLogScroll((s) => Math.max(0, s + delta))
  }, [])

  // Initialize game data and attempt auto-login
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        await loadProto()
        log('协议', 'Proto 加载成功')
      } catch (e: any) {
        log('协议', `Proto 加载失败: ${e.message}`)
      }

      try {
        loadConfigs()
      } catch (e: any) {
        log('配置', `游戏数据加载失败: ${e.message}`)
      }

      if (cancelled) return

      // CLI code takes priority
      if (cliCode) {
        const platform = cliPlatform ?? config.platform
        setIsLoading(true)
        try {
          await addAccount(platform, cliCode)
          if (!cancelled) setScreen('dashboard')
        } catch (e: any) {
          if (!cancelled) setError(e.message)
        } finally {
          if (!cancelled) setIsLoading(false)
        }
        setReady(true)
        return
      }

      // Try auto-login with saved code
      setIsLoading(true)
      try {
        const session = await autoLogin()
        if (session && !cancelled) {
          setScreen('dashboard')
        }
      } catch {
        // Auto-login failed, show login screen
      } finally {
        if (!cancelled) {
          setIsLoading(false)
          setReady(true)
        }
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [])

  const handleLoginQR = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setQrText(null)
    setQrUrl(null)
    try {
      const { qrInfo, poll } = await loginWithQR()
      // Show QR code in UI
      setQrText(qrInfo.qrText)
      setQrUrl(qrInfo.url)
      // Poll in background
      const session = await poll()
      if (session) {
        setQrText(null)
        setQrUrl(null)
        setScreen('dashboard')
      }
    } catch (e: any) {
      setError(e.message)
      setQrText(null)
      setQrUrl(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleAddAccount = useCallback(() => {
    setScreen('login')
    setError(null)
    setQrText(null)
    setQrUrl(null)
  }, [])

  const handleLoginCode = useCallback(async (platform: 'qq' | 'wx', code: string) => {
    setIsLoading(true)
    setError(null)
    try {
      updateConfig({ platform })
      await addAccount(platform, code)
      setScreen('dashboard')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  if (!ready && !cliCode) {
    return (
      <Box flexDirection="column">
        <Box padding={1}>
          <GlobalLogPanel scrollOffset={logScroll} />
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      {screen === 'login' ? (
        <LoginScreen
          onLoginQR={handleLoginQR}
          onLoginCode={handleLoginCode}
          isLoading={isLoading}
          error={error}
          qrText={qrText}
          qrUrl={qrUrl}
          onBack={accountStore.getAccounts().length > 0 ? () => setScreen('dashboard') : undefined}
        />
      ) : (
        <Dashboard
          accountStore={accountStore}
          getSessionStore={getSessionStore}
          onQuit={handleQuit}
          onScrollLog={handleScrollLog}
          onAddAccount={handleAddAccount}
        />
      )}
      <GlobalLogPanel scrollOffset={logScroll} />
      <KeyHint />
    </Box>
  )
}
