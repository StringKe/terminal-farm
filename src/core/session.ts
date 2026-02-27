import { config, getDefaultAccountConfig, loadAccountConfig, updateAccountConfig } from '../config/index.js'
import type { AccountConfig } from '../config/schema.js'
import { Connection } from '../protocol/connection.js'
import { SessionStore } from '../store/session-store.js'
import { type ScopedLogger, createScopedLogger, log, logWarn, onLog } from '../utils/logger.js'
import { EmailManager } from './email.js'
import { FarmManager } from './farm.js'
import { FriendManager } from './friend.js'
import { IllustratedManager } from './illustrated.js'
import { processInviteCodes } from './invite.js'
import { MallManager } from './mall.js'
import { QQVipManager } from './qqvip.js'
import { RedPacketManager } from './redpacket.js'
import { TaskScheduler } from './scheduler.js'
import { ShopManager } from './shop.js'
import { TaskManager } from './task.js'
import { WarehouseManager } from './warehouse.js'
import { WeatherManager } from './weather.js'

export interface SessionOptions {
  onReconnectFailed?: (id: string) => void
}

export class Session {
  readonly conn: Connection
  readonly store: SessionStore
  readonly scheduler: TaskScheduler
  readonly farm: FarmManager
  readonly friend: FriendManager
  readonly task: TaskManager
  readonly warehouse: WarehouseManager
  readonly illustrated: IllustratedManager
  readonly email: EmailManager
  readonly weather: WeatherManager
  readonly qqvip: QQVipManager
  readonly shop: ShopManager
  readonly redpacket: RedPacketManager
  readonly mall: MallManager

  accountConfig: AccountConfig

  private logUnsub: (() => void) | null = null
  private code = ''
  private stopped = false
  private reconnecting = false
  private readonly options: SessionOptions
  private readonly logger: ScopedLogger

  constructor(
    readonly id: string,
    readonly platform: 'qq' | 'wx',
    options?: SessionOptions,
  ) {
    this.options = options ?? {}
    this.accountConfig = getDefaultAccountConfig()
    const getAccountConfig = () => this.accountConfig
    this.logger = createScopedLogger(() => this.conn.userState.name || `GID:${this.conn.userState.gid}`)
    const logger = this.logger
    this.conn = new Connection(config, logger)
    this.store = new SessionStore()
    this.scheduler = new TaskScheduler(config, getAccountConfig, this.store, logger)
    this.farm = new FarmManager(this.conn, this.store, getAccountConfig, logger, this.scheduler)
    this.friend = new FriendManager(this.conn, this.store, this.farm, getAccountConfig, logger, this.scheduler)
    this.task = new TaskManager(this.conn, this.store, logger, this.scheduler)
    this.warehouse = new WarehouseManager(this.conn, this.store, getAccountConfig, logger, this.scheduler)
    this.illustrated = new IllustratedManager(this.conn, logger, this.scheduler)
    this.email = new EmailManager(this.conn, logger, this.scheduler)
    this.weather = new WeatherManager(this.conn, this.store, logger, this.scheduler)
    this.qqvip = new QQVipManager(this.conn, logger, this.scheduler)
    this.shop = new ShopManager(this.conn, getAccountConfig, logger, this.scheduler)
    this.redpacket = new RedPacketManager(this.conn, logger, this.scheduler)
    this.mall = new MallManager(this.conn, logger, this.scheduler)
    this.farm.setIllustratedManager(this.illustrated)

    // Forward connection events to store
    this.conn.on('login', (state) => this.store.updateUser(state))
    this.conn.on('stateChanged', (state) => this.store.updateUser(state))
    this.conn.on('goldChanged', (gold) => this.store.updateUser({ gold }))
    this.conn.on('expChanged', (exp) => this.store.updateUser({ exp }))

    // Handle connection errors and close to prevent unhandled EventEmitter errors
    this.conn.on('error', (err) => {
      logWarn('会话', `连接错误: ${err.message}`)
    })
    this.conn.on('close', () => {
      if (!this.stopped && !this.reconnecting) {
        this.attemptReconnect()
      }
    })

    // Restore persisted daily stats
    this.store.restoreStats()

    // Forward logs to store (only this account's logs)
    this.logUnsub = onLog((entry) => {
      if (entry.accountLabel) {
        const label = this.conn.userState.name || `GID:${this.conn.userState.gid}`
        if (entry.accountLabel !== label) return
      }
      this.store.pushLog(entry)
    })
  }

  async start(code: string): Promise<void> {
    this.code = code
    this.stopped = false
    log('会话', `连接中... platform=${this.platform}`)
    await this.conn.connect(code)

    // Load per-account config
    const gid = this.conn.userState.gid
    if (gid > 0) {
      this.accountConfig = loadAccountConfig(gid)
      log('配置', `已加载账号配置 GID=${gid}`)
    }

    // Process invite codes (WX only)
    await processInviteCodes(this.conn, this.logger)

    // Start all loops
    this.startManagers()

    log('会话', '所有模块已启动')
  }

  updateAccountConfig(partial: Partial<AccountConfig>): AccountConfig {
    const gid = this.conn.userState.gid
    if (gid > 0) {
      this.accountConfig = updateAccountConfig(gid, partial)
    } else {
      Object.assign(this.accountConfig, partial)
    }
    return this.accountConfig
  }

  stop(): void {
    this.stopped = true
    this.stopManagers()
    this.conn.close()
    if (this.logUnsub) {
      this.logUnsub()
      this.logUnsub = null
    }
    log('会话', '已停止')
  }

  private startManagers(): void {
    this.farm.registerTasks()
    this.friend.registerTasks()
    this.task.registerTasks()
    this.warehouse.registerTasks()
    this.illustrated.registerTasks()
    this.email.registerTasks()
    this.weather.registerTasks()
    this.qqvip.registerTasks()
    this.shop.registerTasks()
    this.redpacket.registerTasks()
    this.mall.registerTasks()
    this.scheduler.start()
  }

  private stopManagers(): void {
    this.scheduler.stop()
    this.farm.unregisterListeners()
    this.friend.unregisterListeners()
    this.task.unregisterListeners()
  }

  private async attemptReconnect(): Promise<void> {
    const maxRetries = 3
    const delay = 3000
    this.reconnecting = true
    this.stopManagers()

    for (let i = 1; i <= maxRetries; i++) {
      log('重连', `第 ${i}/${maxRetries} 次尝试，${delay / 1000}s 后重连...`)
      await new Promise((r) => setTimeout(r, delay))

      if (this.stopped) {
        this.reconnecting = false
        return
      }

      try {
        this.conn.cleanup()
        await this.conn.connect(this.code)
        await processInviteCodes(this.conn, this.logger)
        this.startManagers()
        log('重连', '重连成功，所有模块已恢复')
        this.reconnecting = false
        return
      } catch (e: any) {
        logWarn('重连', `第 ${i} 次失败: ${e.message}`)
      }
    }

    this.reconnecting = false
    logWarn('重连', `${maxRetries} 次重连全部失败`)
    this.options.onReconnectFailed?.(this.id)
  }
}
