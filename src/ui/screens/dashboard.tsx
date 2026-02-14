import { Box, Text } from 'ink'
import { useCallback, useMemo, useState } from 'react'
import { config } from '../../config/index.js'
import type { AccountConfig } from '../../config/schema.js'
import type { Session } from '../../core/session.js'
import type { AccountStore } from '../../store/account-store.js'
import type { SessionStore } from '../../store/session-store.js'
import { useKeyboard } from '../hooks/use-keyboard.js'
import { useAccounts, useSessionState } from '../hooks/use-store.js'
import { useTerminalSize } from '../hooks/use-terminal-size.js'
import { BagPanel } from '../panels/bag-panel.js'
import { FarmPanel } from '../panels/farm-panel.js'
import { FriendPanel } from '../panels/friend-panel.js'
import { SettingsPanel } from '../panels/settings-panel.js'
import { StatusBar } from '../panels/status-bar.js'
import { TaskPanel } from '../panels/task-panel.js'

interface DashboardProps {
  accountStore: AccountStore
  getSessionStore: (id: string) => SessionStore
  getSession: (id: string) => Session | undefined
  onQuit: () => void
  onScrollLog?: (delta: number) => void
  onAddAccount?: () => void
}

export function Dashboard({
  accountStore,
  getSessionStore,
  getSession,
  onQuit,
  onScrollLog,
  onAddAccount,
}: DashboardProps) {
  const { isNarrow, columns } = useTerminalSize()
  const { accounts, currentIndex } = useAccounts(accountStore)
  const [showSettings, setShowSettings] = useState(false)
  const [configVersion, setConfigVersion] = useState(0)

  const currentAccount = accounts[currentIndex]
  const sessionStore = useMemo(
    () => (currentAccount ? getSessionStore(currentAccount.id) : null),
    [currentAccount?.id, getSessionStore],
  )
  const state = useSessionState(sessionStore)

  const currentSession = useMemo(
    () => (currentAccount ? getSession(currentAccount.id) : undefined),
    [currentAccount?.id, getSession, configVersion],
  )

  const handleToggleSettings = useCallback(() => {
    setShowSettings((s) => !s)
  }, [])

  const handleUpdateConfig = useCallback(
    (partial: Partial<AccountConfig>) => {
      if (currentSession) {
        currentSession.updateAccountConfig(partial)
        setConfigVersion((v) => v + 1)
      }
    },
    [currentSession],
  )

  useKeyboard({
    onSwitchAccount: showSettings ? undefined : (index) => accountStore.switchTo(index),
    onTabNext: showSettings
      ? undefined
      : () => {
          const next = (currentIndex + 1) % Math.max(1, accounts.length)
          accountStore.switchTo(next)
        },
    onTabPrev: showSettings
      ? undefined
      : () => {
          const prev = (currentIndex - 1 + accounts.length) % Math.max(1, accounts.length)
          accountStore.switchTo(prev)
        },
    onScrollLog: showSettings ? undefined : onScrollLog,
    onAddAccount: showSettings ? undefined : onAddAccount,
    onToggleSettings: showSettings ? undefined : handleToggleSettings,
    onQuit: showSettings ? undefined : onQuit,
  })

  if (!currentAccount || !state) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text dimColor>无活跃账号</Text>
      </Box>
    )
  }

  const friendPanel = (
    <FriendPanel
      progress={state.friendPatrolProgress}
      friendTotal={state.friendTotal}
      stats={state.friendStats}
      friendList={state.friendList}
      columns={columns}
    />
  )

  // Account tabs
  const accountTabs = (
    <Box borderStyle="single" borderColor="gray" paddingX={1} gap={2}>
      {accounts.map((acc, i) => (
        <Text
          key={acc.id}
          bold={i === currentIndex}
          color={i === currentIndex ? 'cyan' : undefined}
          dimColor={i !== currentIndex}
        >
          [{i + 1}] {acc.name || '未命名'}({acc.platform.toUpperCase()})
          {acc.status === 'error' ? ' !' : acc.status === 'connecting' ? ' ...' : ''}
        </Text>
      ))}
      <Text dimColor>[+] 添加账号</Text>
    </Box>
  )

  const statusBar = (
    <StatusBar
      user={state.user}
      platform={currentAccount.platform}
      apiPort={config.apiEnabled ? config.apiPort : undefined}
    />
  )

  const settingsPanel =
    showSettings && currentSession ? (
      <SettingsPanel
        accountConfig={currentSession.accountConfig}
        onUpdate={handleUpdateConfig}
        onClose={handleToggleSettings}
      />
    ) : null

  // Narrow: single column — settings replaces entire content below status
  if (isNarrow) {
    if (settingsPanel) {
      return (
        <Box flexDirection="column">
          {accountTabs}
          {statusBar}
          {settingsPanel}
        </Box>
      )
    }
    return (
      <Box flexDirection="column">
        {accountTabs}
        {statusBar}
        <FarmPanel lands={state.lands} />
        <BagPanel items={state.bag} />
        <TaskPanel tasks={state.taskList} />
        {friendPanel}
      </Box>
    )
  }

  // Wide (>=120) or Medium (100-119): settings replaces right sidebar
  return (
    <Box flexDirection="column">
      {accountTabs}
      {statusBar}
      <Box>
        <Box flexDirection="column" flexGrow={1}>
          <FarmPanel lands={state.lands} flexGrow={1} />
        </Box>
        <Box flexDirection="column" width={32}>
          {settingsPanel ?? (
            <>
              <BagPanel items={state.bag} />
              <TaskPanel tasks={state.taskList} />
            </>
          )}
        </Box>
      </Box>
      {friendPanel}
    </Box>
  )
}
