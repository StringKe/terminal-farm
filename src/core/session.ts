import { config, getDefaultAccountConfig, loadAccountConfig, updateAccountConfig } from '../config/index.js'
import type { AccountConfig } from '../config/schema.js'
import { Connection } from '../protocol/connection.js'
import { SessionStore } from '../store/session-store.js'
import { log, logWarn, onLog } from '../utils/logger.js'
import { EmailManager } from './email.js'
import { FarmManager } from './farm.js'
import { FriendManager } from './friend.js'
import { IllustratedManager } from './illustrated.js'
import { processInviteCodes } from './invite.js'
import { QQVipManager } from './qqvip.js'
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
  readonly farm: FarmManager
  readonly friend: FriendManager
  readonly task: TaskManager
  readonly warehouse: WarehouseManager
  readonly illustrated: IllustratedManager
  readonly email: EmailManager
  readonly weather: WeatherManager
  readonly qqvip: QQVipManager
  readonly shop: ShopManager

  accountConfig: AccountConfig

  private logUnsub: (() => void) | null = null
  private code = ''
  private stopped = false
  private reconnecting = false
  private readonly options: SessionOptions

  constructor(
    readonly id: string,
    readonly platform: 'qq' | 'wx',
    options?: SessionOptions,
  ) {
    this.options = options ?? {}
    this.accountConfig = getDefaultAccountConfig()
    const getAccountConfig = () => this.accountConfig
    this.conn = new Connection(config)
    this.store = new SessionStore()
    this.farm = new FarmManager(this.conn, this.store, getAccountConfig)
    this.friend = new FriendManager(this.conn, this.store, this.farm, getAccountConfig)
    this.task = new TaskManager(this.conn, this.store)
    this.warehouse = new WarehouseManager(this.conn, this.store)
    this.illustrated = new IllustratedManager(this.conn)
    this.email = new EmailManager(this.conn)
    this.weather = new WeatherManager(this.conn, this.store)
    this.qqvip = new QQVipManager(this.conn)
    this.shop = new ShopManager(this.conn, getAccountConfig)

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
    this.store.restoreFriendStats()

    // Forward logs to store
    this.logUnsub = onLog((entry) => this.store.pushLog(entry))
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
    await processInviteCodes(this.conn)

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
    this.farm.start()
    this.friend.start()
    this.task.start()
    this.warehouse.start()
    this.illustrated.start()
    this.email.start()
    this.weather.start()
    this.qqvip.start()
    this.shop.start()
  }

  private stopManagers(): void {
    this.farm.stop()
    this.friend.stop()
    this.task.stop()
    this.warehouse.stop()
    this.illustrated.stop()
    this.email.stop()
    this.weather.stop()
    this.qqvip.stop()
    this.shop.stop()
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
        await processInviteCodes(this.conn)
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
