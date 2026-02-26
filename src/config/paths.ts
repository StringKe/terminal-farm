import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

/** 运行时数据根目录 */
const DATA_ROOT = join(process.cwd(), 'data')

/** 所有运行时数据路径的唯一来源 */
export const paths = {
  dataRoot: DATA_ROOT,
  /** 账号独立配置目录 */
  accountsDir: join(DATA_ROOT, 'accounts'),
  /** 单个账号配置文件 */
  accountConfig: (gid: number) => join(DATA_ROOT, 'accounts', `${gid}.json`),
  /** 登录码持久化 */
  loginCode: join(DATA_ROOT, 'code.json'),
  /** 每日统计 */
  dailyStats: join(DATA_ROOT, 'stats.json'),
  /** 邀请码文件 */
  shareFile: join(DATA_ROOT, 'share.txt'),
  /** 日志目录 */
  logsDir: join(DATA_ROOT, 'logs'),
  /** WebSocket 消息 dump 目录 */
  dumpsDir: join(DATA_ROOT, 'dumps'),
}

/** 确保所有数据目录存在（启动时调用一次） */
export function ensureDataDirs(): void {
  mkdirSync(paths.accountsDir, { recursive: true })
  mkdirSync(paths.logsDir, { recursive: true })
}
