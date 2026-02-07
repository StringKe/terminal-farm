import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { config } from '../../config/index.js'
import { getRecentLogs } from '../../utils/logger.js'

export async function handleSystemLogs(body: any): Promise<Response> {
  const { limit = 50, offset = 0 } = body ?? {}
  const logs = getRecentLogs(limit, offset)
  return Response.json({ ok: true, data: logs })
}

export async function handleSystemConfig(): Promise<Response> {
  const { deviceInfo: _d, ...safeConfig } = config
  return Response.json({ ok: true, data: safeConfig })
}

export async function handleSystemVersion(): Promise<Response> {
  try {
    const versionFile = join(import.meta.dir, '..', '..', '.version.json')
    const data = JSON.parse(readFileSync(versionFile, 'utf8'))
    return Response.json({ ok: true, data })
  } catch {
    return Response.json({ ok: true, data: { version: '0.1.0' } })
  }
}
