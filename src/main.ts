import { config, updateConfig } from './config/index.js'
import { migrateOldDataFiles } from './config/migrate.js'
import { ensureDataDirs } from './config/paths.js'

function parseArgs(args: string[]): {
  code?: string
  platform?: 'qq' | 'wx'
  verify?: boolean
  interval?: number
  friendInterval?: number
  apiEnabled?: boolean
  apiPort?: number
  apiHost?: string
  apiKey?: string
  headless?: boolean
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
    else if (arg === '--api-host' && args[i + 1]) result.apiHost = args[++i]
    else if (arg === '--api-key' && args[i + 1]) result.apiKey = args[++i]
    else if (arg === '--headless') result.headless = true
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
if (cliArgs.apiHost) updateConfig({ apiHost: cliArgs.apiHost })
if (cliArgs.apiKey) updateConfig({ apiKey: cliArgs.apiKey })

// Verify mode: just load protos and exit
if (cliArgs.verify) {
  const { loadProto, getRoot, types } = await import('./protocol/proto-loader.js')
  await loadProto()
  const root = getRoot()
  console.log(`Proto 加载成功，root types: ${Object.keys(root?.nested ?? {}).length}`)
  console.log(`已注册消息类型: ${Object.keys(types).length}`)
  process.exit(0)
}

// Headless mode: no UI, core only + API
if (cliArgs.headless) {
  const { loadProto } = await import('./protocol/proto-loader.js')
  const { loadConfigs } = await import('./config/game-data.js')
  const { addAccount, autoLogin, stopAll } = await import('./core/account.js')
  const { startApiServer } = await import('./api/server.js')
  const { log, logWarn } = await import('./utils/logger.js')

  await loadProto()
  log('headless', 'Proto 加载成功')
  loadConfigs()

  // headless 模式强制启用 API
  updateConfig({ apiEnabled: true })
  startApiServer(config.apiPort, config.apiHost)

  // 登录（有 code 用 code，否则 autoLogin，都没有则等待 API 登录）
  if (cliArgs.code) {
    const platform = cliArgs.platform ?? config.platform
    try {
      await addAccount(platform, cliArgs.code)
      log('headless', '登录成功')
    } catch (e: any) {
      logWarn('headless', `登录失败: ${e.message}，可通过 API 重新登录`)
    }
  } else {
    const session = await autoLogin()
    if (session) {
      log('headless', '自动登录成功')
    } else {
      log('headless', '无保存的登录态，等待通过 API 登录')
    }
  }

  log('headless', `运行中，API: http://${config.apiHost}:${config.apiPort}`)

  // 优雅退出
  const shutdown = () => {
    log('headless', '正在停止...')
    stopAll()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  // 保持进程存活
  setInterval(() => {}, 1 << 30)
} else {
  // Start API server if enabled (UI mode)
  if (config.apiEnabled) {
    const { startApiServer } = await import('./api/server.js')
    startApiServer(config.apiPort, config.apiHost)
  }

  // Render Ink app
  const { render } = await import('ink')
  const React = (await import('react')).default
  const { App } = await import('./app.js')

  const { waitUntilExit } = render(
    React.createElement(App, {
      cliCode: cliArgs.code,
      cliPlatform: cliArgs.platform,
    }),
    { exitOnCtrlC: false },
  )

  await waitUntilExit()
  process.exit(0)
}
