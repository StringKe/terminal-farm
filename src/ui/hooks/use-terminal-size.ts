import { useStdout } from 'ink'
import { useEffect, useState } from 'react'

export interface TerminalSize {
  columns: number
  rows: number
  isNarrow: boolean
  isWide: boolean
}

export function useTerminalSize(): TerminalSize {
  const { stdout } = useStdout()
  const [size, setSize] = useState<TerminalSize>(() => ({
    columns: stdout?.columns ?? 80,
    rows: stdout?.rows ?? 24,
    isNarrow: (stdout?.columns ?? 80) < 100,
    isWide: (stdout?.columns ?? 80) >= 120,
  }))

  useEffect(() => {
    if (!stdout) return

    const onResize = () => {
      setSize({
        columns: stdout.columns,
        rows: stdout.rows,
        isNarrow: stdout.columns < 100,
        isWide: stdout.columns >= 120,
      })
    }

    stdout.on('resize', onResize)
    return () => {
      stdout.off('resize', onResize)
    }
  }, [stdout])

  return size
}
