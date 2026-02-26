import { existsSync, mkdirSync, readdirSync, renameSync, rmdirSync } from 'node:fs'
import { join } from 'node:path'
import { paths } from './paths.js'

const CWD = process.cwd()

/** 旧路径 → 新路径映射 */
const FIXED_MIGRATIONS: [string, string][] = [
  [join(CWD, '.farm-code.json'), paths.loginCode],
  [join(CWD, '.farm-stats.json'), paths.dailyStats],
  [join(CWD, 'share.txt'), paths.shareFile],
]

/** 旧目录 → 新目录映射 */
const DIR_MIGRATIONS: [string, string][] = [
  [join(CWD, 'logs'), paths.logsDir],
  [join(CWD, 'dumps'), paths.dumpsDir],
]

/**
 * 一次性迁移：将项目根目录的旧运行时文件移动到 data/ 下。
 * 仅在旧路径存在且新路径不存在时执行，安全幂等。
 */
export function migrateOldDataFiles(): void {
  // 迁移固定文件
  for (const [oldPath, newPath] of FIXED_MIGRATIONS) {
    moveIfNeeded(oldPath, newPath)
  }

  // 迁移目录（整目录移动）
  for (const [oldDir, newDir] of DIR_MIGRATIONS) {
    moveDirIfNeeded(oldDir, newDir)
  }

  // 迁移账号配置：根目录下纯数字命名的 .json 文件 → data/accounts/
  migrateAccountConfigs()
}

function moveIfNeeded(oldPath: string, newPath: string): void {
  if (!existsSync(oldPath)) return
  if (existsSync(newPath)) return
  try {
    renameSync(oldPath, newPath)
  } catch {}
}

function moveDirIfNeeded(oldDir: string, newDir: string): void {
  if (!existsSync(oldDir)) return
  // 新目录已有内容，逐文件合并
  mkdirSync(newDir, { recursive: true })
  try {
    const entries = readdirSync(oldDir, { withFileTypes: true })
    for (const entry of entries) {
      const src = join(oldDir, entry.name)
      const dst = join(newDir, entry.name)
      if (existsSync(dst)) continue
      try {
        renameSync(src, dst)
      } catch {}
    }
    // 尝试删除空的旧目录（如果还有残留文件则忽略）
    try {
      rmdirSync(oldDir)
    } catch {}
  } catch {}
}

function migrateAccountConfigs(): void {
  try {
    const entries = readdirSync(CWD, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile()) continue
      if (!entry.name.endsWith('.json')) continue
      const name = entry.name.replace('.json', '')
      if (!/^\d+$/.test(name)) continue
      const oldPath = join(CWD, entry.name)
      const newPath = paths.accountConfig(Number(name))
      moveIfNeeded(oldPath, newPath)
    }
  } catch {}
}
