import { useInput } from 'ink'

export type PanelKey = 'farm' | 'bag' | 'task' | 'log'

interface KeyboardActions {
  onSwitchAccount?: (index: number) => void
  onTogglePanel?: (panel: PanelKey) => void
  onQuit?: () => void
  onTabNext?: () => void
}

export function useKeyboard(actions: KeyboardActions): void {
  useInput((input, key) => {
    // Tab: next account
    if (key.tab) {
      actions.onTabNext?.()
      return
    }

    // Number keys 1-9: switch account
    if (input >= '1' && input <= '9') {
      actions.onSwitchAccount?.(Number(input) - 1)
      return
    }

    const lower = input.toLowerCase()

    // Panel toggles
    if (lower === 'f') {
      actions.onTogglePanel?.('farm')
      return
    }
    if (lower === 'b') {
      actions.onTogglePanel?.('bag')
      return
    }
    if (lower === 't') {
      actions.onTogglePanel?.('task')
      return
    }
    if (lower === 'l') {
      actions.onTogglePanel?.('log')
      return
    }

    // Quit
    if (lower === 'q') {
      actions.onQuit?.()
      return
    }

    // Ctrl+C
    if (key.ctrl && input === 'c') {
      actions.onQuit?.()
      return
    }
  })
}
