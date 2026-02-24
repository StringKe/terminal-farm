import type { AccountConfig, AppConfig } from '../config/schema.js'
import type { SessionStore } from '../store/session-store.js'
import type { ScopedLogger } from '../utils/logger.js'
import { randomBetween } from '../utils/random.js'

export interface SchedulerStatus {
  resting: boolean
  restSecondsLeft: number
  intensity: 'low' | 'medium' | 'high'
  taskCount: number
  currentTask: string | null
}

interface IntensityPreset {
  jitterRatio: number
  interTaskDelayMin: number
  interTaskDelayMax: number
  restIntervalMin: number
  restIntervalMax: number
  restDurationMin: number
  restDurationMax: number
}

const PRESETS: Record<string, IntensityPreset> = {
  low: {
    jitterRatio: 0.2,
    interTaskDelayMin: 100,
    interTaskDelayMax: 300,
    restIntervalMin: 30 * 60_000,
    restIntervalMax: 60 * 60_000,
    restDurationMin: 30_000,
    restDurationMax: 60_000,
  },
  medium: {
    jitterRatio: 0.35,
    interTaskDelayMin: 200,
    interTaskDelayMax: 500,
    restIntervalMin: 15 * 60_000,
    restIntervalMax: 40 * 60_000,
    restDurationMin: 60_000,
    restDurationMax: 180_000,
  },
  high: {
    jitterRatio: 0.5,
    interTaskDelayMin: 300,
    interTaskDelayMax: 800,
    restIntervalMin: 8 * 60_000,
    restIntervalMax: 20 * 60_000,
    restDurationMin: 120_000,
    restDurationMax: 300_000,
  },
}

interface RegisteredTask {
  id: string
  name: string
  fn: () => Promise<void>
  type: 'periodic' | 'once'
  intervalMs: number // only for periodic
  nextRunAt: number
}

export class TaskScheduler {
  private tasks = new Map<string, RegisteredTask>()
  private running = false
  private resting = false
  private restEndTime = 0
  private restTimer: ReturnType<typeof setTimeout> | null = null
  private loopTimer: ReturnType<typeof setTimeout> | null = null
  private currentTaskName: string | null = null

  constructor(
    private appConfig: AppConfig,
    private getAccountConfig: () => AccountConfig,
    private store: SessionStore,
    private logger: ScopedLogger,
  ) {}

  private get preset(): IntensityPreset {
    const cfg = this.getAccountConfig()
    if (!cfg.enableHumanMode) {
      return {
        jitterRatio: 0,
        interTaskDelayMin: 0,
        interTaskDelayMax: 0,
        restIntervalMin: 0,
        restIntervalMax: 0,
        restDurationMin: 0,
        restDurationMax: 0,
      }
    }
    return PRESETS[cfg.humanModeIntensity] ?? PRESETS.medium
  }

  get jitterRatio(): number {
    return this.preset.jitterRatio
  }

  /** 周期性任务 */
  every(id: string, fn: () => Promise<void>, opts: { intervalMs: number; startDelayMs?: number; name?: string }): void {
    const now = Date.now()
    this.tasks.set(id, {
      id,
      name: opts.name ?? id,
      fn,
      type: 'periodic',
      intervalMs: opts.intervalMs,
      nextRunAt: now + (opts.startDelayMs ?? 0),
    })
  }

  /** 一次性任务 */
  once(id: string, fn: () => Promise<void>, opts: { delayMs: number; name?: string }): void {
    this.tasks.set(id, {
      id,
      name: opts.name ?? id,
      fn,
      type: 'once',
      intervalMs: 0,
      nextRunAt: Date.now() + opts.delayMs,
    })
  }

  /** 外部触发：将任务提前调度（防抖） */
  trigger(id: string, debounceMs = 500): void {
    const task = this.tasks.get(id)
    if (!task) return
    const p = this.preset
    const jitter = debounceMs * p.jitterRatio
    const newRunAt = Date.now() + debounceMs + (Math.random() * 2 - 1) * jitter
    if (newRunAt < task.nextRunAt) {
      task.nextRunAt = newRunAt
    }
  }

  /** 注销任务 */
  unregister(id: string): void {
    this.tasks.delete(id)
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.processLoop()
    this.scheduleNextRest()
  }

  stop(): void {
    this.running = false
    if (this.loopTimer) {
      clearTimeout(this.loopTimer)
      this.loopTimer = null
    }
    if (this.restTimer) {
      clearTimeout(this.restTimer)
      this.restTimer = null
    }
    this.resting = false
    this.currentTaskName = null
    this.tasks.clear()
    this.emitStatus()
  }

  getStatus(): SchedulerStatus {
    const cfg = this.getAccountConfig()
    return {
      resting: this.resting,
      restSecondsLeft: this.resting ? Math.max(0, Math.ceil((this.restEndTime - Date.now()) / 1000)) : 0,
      intensity: cfg.enableHumanMode ? cfg.humanModeIntensity : 'low',
      taskCount: this.tasks.size,
      currentTask: this.currentTaskName,
    }
  }

  private emitStatus(): void {
    this.store.updateSchedulerStatus(this.getStatus())
  }

  private applyJitter(baseMs: number): number {
    const ratio = this.preset.jitterRatio
    if (ratio <= 0) return baseMs
    const jitter = baseMs * ratio
    return Math.max(0, Math.round(baseMs + (Math.random() * 2 - 1) * jitter))
  }

  private async processLoop(): Promise<void> {
    while (this.running) {
      if (this.resting) {
        this.emitStatus()
        await new Promise((r) => {
          this.loopTimer = setTimeout(r, 1000)
        })
        this.loopTimer = null
        continue
      }

      const now = Date.now()
      // 找到所有到期的任务
      const dueTasks: RegisteredTask[] = []
      let earliestFuture = Number.POSITIVE_INFINITY
      for (const task of this.tasks.values()) {
        if (task.nextRunAt <= now) {
          dueTasks.push(task)
        } else if (task.nextRunAt < earliestFuture) {
          earliestFuture = task.nextRunAt
        }
      }

      if (dueTasks.length === 0) {
        const waitMs = Math.min(earliestFuture - now, 500)
        await new Promise((r) => {
          this.loopTimer = setTimeout(r, Math.max(waitMs, 50))
        })
        this.loopTimer = null
        continue
      }

      // 多个到期时随机选一个
      const task = dueTasks.length === 1 ? dueTasks[0] : dueTasks[Math.floor(Math.random() * dueTasks.length)]

      this.currentTaskName = task.name
      this.emitStatus()

      try {
        await task.fn()
      } catch (e: any) {
        this.logger.logWarn('调度', `任务 [${task.name}] 异常: ${e.message}`)
      }

      this.currentTaskName = null

      if (!this.running) break

      // 重新调度或删除
      if (task.type === 'periodic') {
        task.nextRunAt = Date.now() + this.applyJitter(task.intervalMs)
      } else {
        this.tasks.delete(task.id)
      }

      // 任务间延迟
      const p = this.preset
      if (p.interTaskDelayMax > 0) {
        const delay = randomBetween(p.interTaskDelayMin, p.interTaskDelayMax)
        await new Promise((r) => {
          this.loopTimer = setTimeout(r, delay)
        })
        this.loopTimer = null
      }

      this.emitStatus()
    }
  }

  private scheduleNextRest(): void {
    const cfg = this.getAccountConfig()
    if (!cfg.enableHumanMode) return

    const p = this.preset
    if (p.restIntervalMax <= 0) return

    const delay = randomBetween(p.restIntervalMin, p.restIntervalMax)
    this.restTimer = setTimeout(() => {
      this.restTimer = null
      if (!this.running) return
      this.startRest()
    }, delay)
  }

  private startRest(): void {
    const p = this.preset
    const duration = randomBetween(p.restDurationMin, p.restDurationMax)
    this.resting = true
    this.restEndTime = Date.now() + duration
    this.logger.log('调度', `进入休息 ${Math.round(duration / 1000)}s`)
    this.emitStatus()

    this.restTimer = setTimeout(() => {
      this.restTimer = null
      this.endRest()
    }, duration)
  }

  private endRest(): void {
    this.resting = false
    this.restEndTime = 0
    this.logger.log('调度', '休息结束')
    this.emitStatus()
    this.scheduleNextRest()
  }
}
