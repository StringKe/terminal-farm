import { useInput } from 'ink'

interface KeyboardActions {
  onSwitchAccount?: (index: number) => void
  onTabNext?: () => void
  onTabPrev?: () => void
  onScrollLog?: (delta: number) => void
  onAddAccount?: () => void
  onQuit?: () => void
}

export function useKeyboard(actions: KeyboardActions): void {
  useInput((input, key) => {
    // Tab / Right arrow: next account
    if (key.tab || key.rightArrow) {
      actions.onTabNext?.()
      return
    }

    // Left arrow: previous account
    if (key.leftArrow) {
      actions.onTabPrev?.()
      return
    }

    // Up arrow: scroll log up (older)
    if (key.upArrow) {
      actions.onScrollLog?.(1)
      return
    }

    // Down arrow: scroll log down (newer)
    if (key.downArrow) {
      actions.onScrollLog?.(-1)
      return
    }

    // Number keys 1-9: switch account
    if (input >= '1' && input <= '9') {
      actions.onSwitchAccount?.(Number(input) - 1)
      return
    }

    // Add account
    if (input === '+' || input === '=') {
      actions.onAddAccount?.()
      return
    }

    // Quit
    if (input.toLowerCase() === 'q') {
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
