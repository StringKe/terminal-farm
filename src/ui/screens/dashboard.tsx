import { Box, Text } from 'ink'
import { useMemo, useState } from 'react'
import { config } from '../../config/index.js'
import type { AccountStore } from '../../store/account-store.js'
import type { SessionStore } from '../../store/session-store.js'
import { KeyHint } from '../components/key-hint.js'
import { type PanelKey, useKeyboard } from '../hooks/use-keyboard.js'
import { useAccounts, useSessionState } from '../hooks/use-store.js'
import { useTerminalSize } from '../hooks/use-terminal-size.js'
import { BagPanel } from '../panels/bag-panel.js'
import { FarmPanel } from '../panels/farm-panel.js'
import { FriendPanel } from '../panels/friend-panel.js'
import { LogPanel } from '../panels/log-panel.js'
import { StatusBar } from '../panels/status-bar.js'
import { TaskPanel } from '../panels/task-panel.js'

interface DashboardProps {
  accountStore: AccountStore
  getSessionStore: (id: string) => SessionStore
  onQuit: () => void
}

export function Dashboard({ accountStore, getSessionStore, onQuit }: DashboardProps) {
  const { isNarrow } = useTerminalSize()
  const { accounts, currentIndex } = useAccounts(accountStore)
  const [panels, setPanels] = useState<Record<PanelKey, boolean>>({
    farm: true,
    bag: true,
    task: true,
    log: true,
  })

  const currentAccount = accounts[currentIndex]
  const sessionStore = useMemo(
    () => (currentAccount ? getSessionStore(currentAccount.id) : null),
    [currentAccount?.id, getSessionStore],
  )
  const state = useSessionState(sessionStore)

  useKeyboard({
    onSwitchAccount: (index) => accountStore.switchTo(index),
    onTabNext: () => {
      const next = (currentIndex + 1) % Math.max(1, accounts.length)
      accountStore.switchTo(next)
    },
    onTogglePanel: (panel) => {
      setPanels((p) => ({ ...p, [panel]: !p[panel] }))
    },
    onQuit,
  })

  if (!currentAccount || !state) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text dimColor>无活跃账号</Text>
      </Box>
    )
  }

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

  const farmSection = panels.farm && <FarmPanel lands={state.lands} />
  const bagSection = panels.bag && <BagPanel items={state.bag} />
  const taskSection = panels.task && <TaskPanel tasks={state.tasks} />
  const friendSection = <FriendPanel progress={state.friendPatrolProgress} stats={state.friendStats} />
  const logSection = panels.log && <LogPanel logs={state.logs} />

  if (isNarrow) {
    // Single-column stacked layout for narrow terminals
    return (
      <Box flexDirection="column">
        {accountTabs}
        <StatusBar
          user={state.user}
          platform={currentAccount.platform}
          apiPort={config.apiEnabled ? config.apiPort : undefined}
        />
        {farmSection}
        {bagSection}
        {taskSection}
        {friendSection}
        {logSection}
        <KeyHint />
      </Box>
    )
  }

  // Wide layout: farm | bag+task side by side, then friend, log
  return (
    <Box flexDirection="column">
      {accountTabs}
      <StatusBar
        user={state.user}
        platform={currentAccount.platform}
        apiPort={config.apiEnabled ? config.apiPort : undefined}
      />
      <Box>
        <Box flexDirection="column" flexGrow={1}>
          {farmSection}
        </Box>
        <Box flexDirection="column" width={30}>
          {bagSection}
          {taskSection}
        </Box>
      </Box>
      {friendSection}
      {logSection}
      <KeyHint />
    </Box>
  )
}
