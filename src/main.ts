import { render } from 'ink'
import React from 'react'
import { App } from './app.js'
import { config, updateConfig } from './config/index.js'
import { ensureDataDirs } from './config/paths.js'
import { migrateOldDataFiles } from './config/migrate.js'

function parseArgs(args: string[]): {
  code?: string
  platform?: 'qq' | 'wx'
  verify?: boolean
  interval?: number
  friendInterval?: number
  apiEnabled?: boolean
  apiPort?: number
} {
  const result: ReturnType<typeof parseArgs> = {}
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--code' && args[i + 1]) result.code = args[++i]
    else if (arg === '--wx') result.platform = 'wx'
    else if (arg === '--qq') result.platform = 'qq'
    else if (arg === '--verify') result.verify = true
    else if (arg === '--interval' && args[i + 1]) result.interval = Number(args[++i]) * 1000
    else if (arg === '--friend-interval' && args[i + 1]) result.friendInterval = Number(args[++i]) * 1000
    else if (arg === '--api') result.apiEnabled = true
    else if (arg === '--api-port' && args[i + 1]) result.apiPort = Number(args[++i])
  }
  return result
}

// 初始化数据目录 & 迁移旧文件
ensureDataDirs()
migrateOldDataFiles()

const cliArgs = parseArgs(process.argv.slice(2))

// Apply CLI overrides to config
if (cliArgs.platform) updateConfig({ platform: cliArgs.platform })
if (cliArgs.interval) updateConfig({ farmCheckInterval: cliArgs.interval })
if (cliArgs.friendInterval) updateConfig({ friendCheckInterval: cliArgs.friendInterval })
if (cliArgs.apiEnabled) updateConfig({ apiEnabled: true })
if (cliArgs.apiPort) updateConfig({ apiPort: cliArgs.apiPort })

// Verify mode: just load protos and exit
if (cliArgs.verify) {
  const { loadProto, getRoot, types } = await import('./protocol/proto-loader.js')
  await loadProto()
  const root = getRoot()
  console.log(`Proto 加载成功，root types: ${Object.keys(root?.nested ?? {}).length}`)
  console.log(`已注册消息类型: ${Object.keys(types).length}`)
  process.exit(0)
}

// Start API server if enabled
if (config.apiEnabled) {
  const { startApiServer } = await import('./api/server.js')
  startApiServer(config.apiPort)
}

// Render Ink app (normal mode, no fullScreen for Warp compatibility)
const { waitUntilExit } = render(
  React.createElement(App, {
    cliCode: cliArgs.code,
    cliPlatform: cliArgs.platform,
  }),
  { exitOnCtrlC: false },
)

await waitUntilExit()
process.exit(0)
