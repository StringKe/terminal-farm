import type { AppConfig } from '../config/schema.js'
import type { Connection } from '../protocol/connection.js'
import { types } from '../protocol/proto-loader.js'
import type { ScopedLogger } from '../utils/logger.js'
import { toLong } from '../utils/long.js'

// 行为流事件类型（与客户端 game.js 一致）
const FLOW = {
  LOADING_START: 1,
  PRELOAD_COMPLETE: 2,
  LOADING_END: 3,
  GAME_LOGIN: 4,
  GAME_PLAY_TIME: 5,
} as const

function mapOsType(os: string): number {
  const lower = os.toLowerCase()
  if (lower.includes('ios')) return 2
  if (lower.includes('android')) return 1
  if (lower.includes('harmony')) return 3
  if (lower.includes('pc') || lower.includes('windows')) return 4
  return 0
}

function mapPlatformType(platform: string): number {
  if (platform === 'qq') return 2
  if (platform === 'wx') return 1
  return 0
}

export class TlogReportManager {
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private buffer: any[] = []
  private startTime = 0
  private totalFlushed = 0
  private osType: number
  private platFromType: number

  private static readonly FLUSH_INTERVAL = 10_000
  private static readonly MAX_BUFFER_SIZE = 10

  constructor(
    private conn: Connection,
    private config: AppConfig,
    private logger: ScopedLogger,
  ) {
    this.osType = mapOsType(config.os)
    this.platFromType = mapPlatformType(config.platform)
  }

  start(): void {
    this.startTime = Date.now()
    this.startFlushTimer()
    this.reportStartupSequence()
  }

  stop(): void {
    if (this.startTime > 0) {
      const playTimeSec = Math.floor((Date.now() - this.startTime) / 1000)
      this.report('GAME_PLAY_TIME', FLOW.GAME_PLAY_TIME, playTimeSec)
      this.flush()
      this.logger.log('Tlog', `已停止 (累计上报 ${this.totalFlushed} 条, 在线 ${playTimeSec}s)`)
    }
    this.stopFlushTimer()
    this.buffer = []
    this.startTime = 0
    this.totalFlushed = 0
  }

  report(eventName: string, flowType: number, ...params: (string | number)[]): void {
    const state = this.conn.userState
    const flow: any = {
      os_type: this.osType,
      plat_from_type: this.platFromType,
      open_id: state.openId,
      gid: toLong(state.gid),
      name: state.name,
      now: toLong(Date.now()),
      level: toLong(state.level),
      flow_type: toLong(flowType),
      flow_type_str: eventName,
    }

    for (let i = 0; i < params.length; i++) {
      const val = params[i]
      if (i < 5) {
        flow[`param_int${i + 1}`] = toLong(typeof val === 'number' ? val : 0)
      } else {
        flow[`param_str${i + 1}`] = String(val)
      }
    }

    this.buffer.push(flow)
    if (this.buffer.length >= TlogReportManager.MAX_BUFFER_SIZE) {
      this.flush()
    }
  }

  private reportStartupSequence(): void {
    // 模拟客户端启动序列: LOADING_START -> PRELOAD_COMPLETE + LOADING_END -> GAME_LOGIN
    this.report('LOADING_START', FLOW.LOADING_START)

    const loadingTime = 2000 + Math.floor(Math.random() * 3000) // 2~5s
    setTimeout(
      () => {
        if (!this.flushTimer) return // 已停止
        this.report('PRELOAD_COMPLETE', FLOW.PRELOAD_COMPLETE)
        this.report('LOADING_END', FLOW.LOADING_END, loadingTime)
        this.report('GAME_LOGIN', FLOW.GAME_LOGIN)
        this.logger.log('Tlog', `启动序列已上报 (loading_time=${loadingTime}ms)`)
      },
      500 + Math.floor(Math.random() * 500),
    )
  }

  private flush(): void {
    if (this.buffer.length === 0) return
    if (!this.conn.isConnected()) return

    const flows = this.buffer.splice(0)
    const count = flows.length

    try {
      const body = types.BatchClientReportFlowRequest.encode(
        types.BatchClientReportFlowRequest.create({ flows }),
      ).finish()
      this.conn.sendMsg('gamepb.userpb.UserService', 'BatchClientReportFlow', body, (err) => {
        if (err) {
          this.logger.logWarn('Tlog', `批量上报失败: ${err.message}`)
        } else {
          this.totalFlushed += count
          this.logger.log('Tlog', `上报 ${count} 条 (累计 ${this.totalFlushed})`)
        }
      })
    } catch (e: any) {
      this.logger.logWarn('Tlog', `编码失败: ${e.message}`)
    }
  }

  private startFlushTimer(): void {
    this.stopFlushTimer()
    this.flushTimer = setInterval(() => this.flush(), TlogReportManager.FLUSH_INTERVAL)
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
  }
}
