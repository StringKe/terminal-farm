import { config, versionData } from '../../config/index.js'
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
  return Response.json({ ok: true, data: versionData })
}
