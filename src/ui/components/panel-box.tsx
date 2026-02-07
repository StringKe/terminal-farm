import { Box, Text } from 'ink'
import type React from 'react'

interface PanelBoxProps {
  title: string
  children: React.ReactNode
  width?: number | string
  height?: number
  borderColor?: string
}

export function PanelBox({ title, children, width, height, borderColor = 'gray' }: PanelBoxProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor}
      width={width}
      height={height}
      paddingX={1}
    >
      <Box>
        <Text bold color="cyan">
          {title}
        </Text>
      </Box>
      {children}
    </Box>
  )
}
