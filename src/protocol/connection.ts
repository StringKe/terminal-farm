import { EventEmitter } from 'node:events'
import WebSocket from 'ws'
import type { AppConfig } from '../config/schema.js'
import { log, logWarn } from '../utils/logger.js'
import { toLong, toNum } from '../utils/long.js'
import { syncServerTime } from '../utils/time.js'
import { types } from './proto-loader.js'
import type { UserState } from './types.js'

type SendCallback = (err: Error | null, body?: Uint8Array, meta?: any) => void

export class Connection extends EventEmitter {
  private ws: WebSocket | null = null
  private clientSeq = 1
  private serverSeq = 0
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private pendingCallbacks = new Map<number, SendCallback>()
  private lastHeartbeatResponse = Date.now()
  private heartbeatMissCount = 0

  readonly userState: UserState = { gid: 0, name: '', level: 0, gold: 0, exp: 0 }

  constructor(private config: AppConfig) {
    super()
  }

  connect(code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${this.config.serverUrl}?platform=${this.config.platform}&os=${this.config.os}&ver=${this.config.clientVersion}&code=${code}&openID=`
      let settled = false

      this.ws = new WebSocket(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13)',
          Origin: 'https://gate-obt.nqf.qq.com',
        },
      })

      this.ws.binaryType = 'arraybuffer'

      this.ws.on('open', () => {
        this.sendLogin()
          .then(() => {
            settled = true
            resolve()
          })
          .catch((err) => {
            settled = true
            reject(err)
          })
      })

      this.ws.on('message', (data: Buffer | ArrayBuffer) => {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
        this.handleMessage(buf)
      })

      this.ws.on('close', (code, _reason) => {
        log('WS', `连接关闭 (code=${code})`)
        this.cleanup()
        if (!settled) {
          settled = true
          reject(new Error(`连接关闭 (code=${code})`))
        }
        this.emit('close', code)
      })

      this.ws.on('error', (err) => {
        logWarn('WS', `错误: ${err.message}`)
        if (!settled) {
          settled = true
          reject(err)
        }
        this.emit('error', err)
      })
    })
  }

  sendMsg(serviceName: string, methodName: string, bodyBytes: Uint8Array, callback?: SendCallback): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      log('WS', '连接未打开')
      return false
    }
    const seq = this.clientSeq
    const msg = types.GateMessage.create({
      meta: {
        service_name: serviceName,
        method_name: methodName,
        message_type: 1,
        client_seq: toLong(seq),
        server_seq: toLong(this.serverSeq),
      },
      body: bodyBytes || Buffer.alloc(0),
    })
    const encoded = types.GateMessage.encode(msg).finish()
    this.clientSeq++
    if (callback) this.pendingCallbacks.set(seq, callback)
    this.ws.send(encoded)
    return true
  }

  sendMsgAsync(
    serviceName: string,
    methodName: string,
    bodyBytes: Uint8Array,
    timeout = 10000,
  ): Promise<{ body: Uint8Array; meta: any }> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error(`连接未打开: ${methodName}`))
        return
      }
      const seq = this.clientSeq
      const timer = setTimeout(() => {
        this.pendingCallbacks.delete(seq)
        reject(new Error(`请求超时: ${methodName} (seq=${seq}, pending=${this.pendingCallbacks.size})`))
      }, timeout)

      const sent = this.sendMsg(serviceName, methodName, bodyBytes, (err, body, meta) => {
        clearTimeout(timer)
        if (err) reject(err)
        else resolve({ body: body!, meta })
      })
      if (!sent) {
        clearTimeout(timer)
        reject(new Error(`发送失败: ${methodName}`))
      }
    })
  }

  private handleMessage(buf: Buffer): void {
    try {
      const msg = types.GateMessage.decode(buf)
      const meta = msg.meta
      if (!meta) return

      if (meta.server_seq) {
        const seq = toNum(meta.server_seq)
        if (seq > this.serverSeq) this.serverSeq = seq
      }

      const msgType = meta.message_type

      if (msgType === 3) {
        this.handleNotify(msg)
        return
      }

      if (msgType === 2) {
        const errorCode = toNum(meta.error_code)
        const clientSeqVal = toNum(meta.client_seq)
        const cb = this.pendingCallbacks.get(clientSeqVal)
        if (cb) {
          this.pendingCallbacks.delete(clientSeqVal)
          if (errorCode !== 0) {
            cb(
              new Error(`${meta.service_name}.${meta.method_name} 错误: code=${errorCode} ${meta.error_message || ''}`),
            )
          } else {
            cb(null, msg.body, meta)
          }
          return
        }
        if (errorCode !== 0) {
          logWarn('错误', `${meta.service_name}.${meta.method_name} code=${errorCode} ${meta.error_message || ''}`)
        }
      }
    } catch (err: any) {
      logWarn('解码', err.message)
    }
  }

  private handleNotify(msg: any): void {
    if (!msg.body || msg.body.length === 0) return
    try {
      const event = types.EventMessage.decode(msg.body)
      const type = event.message_type || ''
      const eventBody = event.body

      if (type.includes('Kickout')) {
        log('推送', `被踢下线! ${type}`)
        try {
          const notify = types.KickoutNotify.decode(eventBody)
          log('推送', `原因: ${(notify as any).reason_message || '未知'}`)
        } catch {}
        this.emit('kickout')
        return
      }

      if (type.includes('LandsNotify')) {
        try {
          const notify = types.LandsNotify.decode(eventBody) as any
          const hostGid = toNum(notify.host_gid)
          const lands = notify.lands || []
          if (lands.length > 0 && (hostGid === this.userState.gid || hostGid === 0)) {
            this.emit('landsChanged', lands)
          }
        } catch {}
        return
      }

      if (type.includes('ItemNotify')) {
        try {
          const notify = types.ItemNotify.decode(eventBody) as any
          const items = notify.items || []
          for (const itemChg of items) {
            const item = itemChg.item
            if (!item) continue
            const id = toNum(item.id)
            const count = toNum(item.count)
            if (id === 1101 || id === 2) {
              this.userState.exp = count
              this.emit('expChanged', count)
            } else if (id === 1 || id === 1001) {
              this.userState.gold = count
              this.emit('goldChanged', count)
            }
          }
        } catch {}
        return
      }

      if (type.includes('BasicNotify')) {
        try {
          const notify = types.BasicNotify.decode(eventBody) as any
          if (notify.basic) {
            const oldLevel = this.userState.level
            this.userState.level = toNum(notify.basic.level) || this.userState.level
            this.userState.gold = toNum(notify.basic.gold) || this.userState.gold
            const exp = toNum(notify.basic.exp)
            if (exp > 0) this.userState.exp = exp
            if (this.userState.level !== oldLevel) {
              log('系统', `升级! Lv${oldLevel} → Lv${this.userState.level}`)
              this.emit('levelUp', { oldLevel, newLevel: this.userState.level })
            }
            this.emit('stateChanged', this.userState)
          }
        } catch {}
        return
      }

      if (type.includes('FriendApplicationReceivedNotify')) {
        try {
          const notify = types.FriendApplicationReceivedNotify.decode(eventBody) as any
          const applications = notify.applications || []
          if (applications.length > 0) this.emit('friendApplicationReceived', applications)
        } catch {}
        return
      }

      if (type.includes('FriendAddedNotify')) {
        try {
          const notify = types.FriendAddedNotify.decode(eventBody) as any
          const friends = notify.friends || []
          if (friends.length > 0) {
            const names = friends.map((f: any) => f.name || f.remark || `GID:${toNum(f.gid)}`).join(', ')
            log('好友', `新好友: ${names}`)
          }
        } catch {}
        return
      }

      if (type.includes('GoodsUnlockNotify')) {
        try {
          const notify = types.GoodsUnlockNotify.decode(eventBody) as any
          const goods = notify.goods_list || []
          if (goods.length > 0) log('商店', `解锁 ${goods.length} 个新商品!`)
        } catch {}
        return
      }

      if (type.includes('TaskInfoNotify')) {
        try {
          const notify = types.TaskInfoNotify.decode(eventBody) as any
          if (notify.task_info) this.emit('taskInfoNotify', notify.task_info)
        } catch {}
        return
      }
    } catch (e: any) {
      logWarn('推送', `解码失败: ${e.message}`)
    }
  }

  private async sendLogin(): Promise<void> {
    const body = types.LoginRequest.encode(
      types.LoginRequest.create({
        sharer_id: toLong(0),
        sharer_open_id: '',
        device_info: this.config.deviceInfo,
        share_cfg_id: toLong(0),
        scene_id: '1256',
        report_data: {
          callback: '',
          cd_extend_info: '',
          click_id: '',
          clue_token: '',
          minigame_channel: 'other',
          minigame_platid: 2,
          req_id: '',
          trackid: '',
        },
      }),
    ).finish()

    return new Promise((resolve, reject) => {
      this.sendMsg('gamepb.userpb.UserService', 'Login', body, (err, bodyBytes) => {
        if (err) {
          log('登录', `失败: ${err.message}`)
          reject(err)
          return
        }
        try {
          const reply = types.LoginReply.decode(bodyBytes!) as any
          if (reply.basic) {
            this.userState.gid = toNum(reply.basic.gid)
            this.userState.name = reply.basic.name || '未知'
            this.userState.level = toNum(reply.basic.level)
            this.userState.gold = toNum(reply.basic.gold)
            this.userState.exp = toNum(reply.basic.exp)
            if (reply.time_now_millis) syncServerTime(toNum(reply.time_now_millis))

            log(
              '登录',
              `成功 GID=${this.userState.gid} ${this.userState.name} Lv${this.userState.level} 金币=${this.userState.gold}`,
            )
          }
          this.startHeartbeat()
          this.emit('login', this.userState)
          resolve()
        } catch (e: any) {
          log('登录', `解码失败: ${e.message}`)
          reject(e)
        }
      })
    })
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    this.lastHeartbeatResponse = Date.now()
    this.heartbeatMissCount = 0

    this.heartbeatTimer = setInterval(() => {
      if (!this.userState.gid) return

      const timeSinceLastResponse = Date.now() - this.lastHeartbeatResponse
      if (timeSinceLastResponse > 60000) {
        this.heartbeatMissCount++
        logWarn('心跳', `连接可能已断开 (${Math.round(timeSinceLastResponse / 1000)}s 无响应)`)
        if (this.heartbeatMissCount >= 2) {
          log('心跳', '尝试重连...')
          this.pendingCallbacks.forEach((cb) => {
            try {
              cb(new Error('连接超时，已清理'))
            } catch {}
          })
          this.pendingCallbacks.clear()
        }
      }

      const body = types.HeartbeatRequest.encode(
        types.HeartbeatRequest.create({
          gid: toLong(this.userState.gid),
          client_version: this.config.clientVersion,
        }),
      ).finish()
      this.sendMsg('gamepb.userpb.UserService', 'Heartbeat', body, (err, replyBody) => {
        if (err || !replyBody) return
        this.lastHeartbeatResponse = Date.now()
        this.heartbeatMissCount = 0
        try {
          const reply = types.HeartbeatReply.decode(replyBody) as any
          if (reply.server_time) syncServerTime(toNum(reply.server_time))
        } catch {}
      })
    }, this.config.heartbeatInterval)
  }

  cleanup(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    this.pendingCallbacks.clear()
  }

  close(): void {
    this.cleanup()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}
