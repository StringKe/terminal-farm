import { config } from '../config/index.js'
import { Connection } from '../protocol/connection.js'
import { SessionStore } from '../store/session-store.js'
import { log, logWarn, onLog } from '../utils/logger.js'
import { FarmManager } from './farm.js'
import { FriendManager } from './friend.js'
import { processInviteCodes } from './invite.js'
import { TaskManager } from './task.js'
import { WarehouseManager } from './warehouse.js'

export class Session {
  readonly conn: Connection
  readonly store: SessionStore
  readonly farm: FarmManager
  readonly friend: FriendManager
  readonly task: TaskManager
  readonly warehouse: WarehouseManager

  private logUnsub: (() => void) | null = null

  constructor(
    readonly id: string,
    readonly platform: 'qq' | 'wx',
  ) {
    this.conn = new Connection(config)
    this.store = new SessionStore()
    this.farm = new FarmManager(this.conn, this.store)
    this.friend = new FriendManager(this.conn, this.store, this.farm)
    this.task = new TaskManager(this.conn)
    this.warehouse = new WarehouseManager(this.conn, this.store)

    // Forward connection events to store
    this.conn.on('login', (state) => this.store.updateUser(state))
    this.conn.on('stateChanged', (state) => this.store.updateUser(state))
    this.conn.on('goldChanged', (gold) => this.store.updateUser({ gold }))
    this.conn.on('expChanged', (exp) => this.store.updateUser({ exp }))

    // Handle connection errors and close to prevent unhandled EventEmitter errors
    this.conn.on('error', (err) => {
      logWarn('会话', `连接错误: ${err.message}`)
    })
    this.conn.on('close', (code) => {
      log('会话', `连接关闭 (code=${code})`)
    })

    // Forward logs to store
    this.logUnsub = onLog((entry) => this.store.pushLog(entry))
  }

  async start(code: string): Promise<void> {
    log('会话', `连接中... platform=${this.platform}`)
    await this.conn.connect(code)

    // Process invite codes (WX only)
    await processInviteCodes(this.conn)

    // Start all loops
    this.farm.start()
    this.friend.start()
    this.task.start()
    this.warehouse.start()

    log('会话', '所有模块已启动')
  }

  stop(): void {
    this.farm.stop()
    this.friend.stop()
    this.task.stop()
    this.warehouse.stop()
    this.conn.close()
    if (this.logUnsub) {
      this.logUnsub()
      this.logUnsub = null
    }
    log('会话', '已停止')
  }
}
