import type { Connection } from '../protocol/connection.js'
import { types } from '../protocol/proto-loader.js'
import type { SessionStore } from '../store/session-store.js'
import type { ScopedLogger } from '../utils/logger.js'
import { toNum } from '../utils/long.js'

const WEATHER_NAMES: Record<number, string> = {
  0: '未知',
  1: '晴天',
  2: '多云',
  3: '阴天',
  4: '小雨',
  5: '大雨',
  6: '雷雨',
  7: '下雪',
  8: '大雪',
  9: '大风',
  10: '雾霾',
}

export function getWeatherName(id: number): string {
  return WEATHER_NAMES[id] || `天气${id}`
}

export class WeatherManager {
  private initTimer: ReturnType<typeof setTimeout> | null = null
  private refreshTimer: ReturnType<typeof setInterval> | null = null

  constructor(
    private conn: Connection,
    private store: SessionStore,
    private logger: ScopedLogger,
  ) {}

  async fetchTodayWeather(): Promise<void> {
    try {
      const body = types.GetTodayWeatherRequest.encode(types.GetTodayWeatherRequest.create({})).finish()
      const { body: replyBody } = await this.conn.sendMsgAsync(
        'gamepb.weatherpb.WeatherService',
        'GetTodayWeather',
        body,
      )
      const reply = types.GetTodayWeatherReply.decode(replyBody) as any
      const slots = reply.today_weathers || []
      if (!slots.length) return

      const current = slots.find((s: any) => s.is_current)
      if (current) {
        const weatherId = toNum(current.weather)
        const name = getWeatherName(weatherId)
        this.logger.log('天气', `当前: ${name}`)
        this.store.updateWeather({ currentWeatherId: weatherId, currentWeatherName: name, slots })
      }

      const forecast = slots
        .map((s: any) => {
          const id = toNum(s.weather)
          return `${getWeatherName(id)}${s.is_current ? '(当前)' : ''}`
        })
        .join(' → ')
      this.logger.log('天气', `今日: ${forecast}`)
    } catch (e: any) {
      this.logger.logWarn('天气', `获取天气失败: ${e.message}`)
    }
  }

  start(): void {
    this.initTimer = setTimeout(() => {
      this.initTimer = null
      this.fetchTodayWeather()
    }, 3000)

    // 每30分钟刷新一次天气
    this.refreshTimer = setInterval(() => this.fetchTodayWeather(), 30 * 60 * 1000)
  }

  stop(): void {
    if (this.initTimer) {
      clearTimeout(this.initTimer)
      this.initTimer = null
    }
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
  }
}
