import { Box, Text, useApp } from 'ink'
import { useCallback, useEffect, useState } from 'react'
import { loadConfigs } from './config/game-data.js'
import { config, updateConfig } from './config/index.js'
import { addAccount, autoLogin, loginWithQR, stopAll } from './core/account.js'
import { accountStore, getSessionStore } from './store/index.js'
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

  // Initialize game data and attempt auto-login
  useEffect(() => {
    let cancelled = false

    async function init() {
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
    try {
      await loginWithQR()
      setScreen('dashboard')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
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

  const handleQuit = useCallback(() => {
    stopAll()
    exit()
  }, [exit])

  if (!ready && !cliCode) {
    return (
      <Box padding={1}>
        <Text>正在初始化...</Text>
      </Box>
    )
  }

  if (screen === 'login') {
    return <LoginScreen onLoginQR={handleLoginQR} onLoginCode={handleLoginCode} isLoading={isLoading} error={error} />
  }

  return <Dashboard accountStore={accountStore} getSessionStore={getSessionStore} onQuit={handleQuit} />
}
