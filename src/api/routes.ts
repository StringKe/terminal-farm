import { config } from '../config/index.js'
import { handleAccountAdd, handleAccountList, handleAccountRemove } from './handlers/account.js'
import { handleFarmHarvest, handleFarmReplant, handleFarmStatus } from './handlers/farm.js'
import { handleFriendList, handleFriendPatrol } from './handlers/friend.js'
import { handleLoginQRCreate, handleLoginQRPoll } from './handlers/login.js'
import { handleStatsHistory, handleStatsSummary } from './handlers/stats.js'
import { handleSystemConfig, handleSystemLogs, handleSystemVersion } from './handlers/system.js'
import { handleOpenAPISpec, handleSwagger } from './swagger.js'

type RouteHandler = (body: any) => Promise<Response>

const routes: Record<string, RouteHandler> = {
  'POST /account/list': handleAccountList,
  'POST /account/add': handleAccountAdd,
  'POST /account/remove': handleAccountRemove,
  'POST /login/qr-create': handleLoginQRCreate,
  'POST /login/qr-poll': handleLoginQRPoll,
  'POST /farm/status': handleFarmStatus,
  'POST /farm/harvest': handleFarmHarvest,
  'POST /farm/replant': handleFarmReplant,
  'POST /friend/list': handleFriendList,
  'POST /friend/patrol': handleFriendPatrol,
  'POST /stats/summary': handleStatsSummary,
  'POST /stats/history': handleStatsHistory,
  'POST /system/logs': handleSystemLogs,
  'POST /system/config': handleSystemConfig,
  'POST /system/version': handleSystemVersion,
  'GET /swagger': handleSwagger,
  'GET /openapi.json': handleOpenAPISpec,
  'GET /health': async () => Response.json({ ok: true, uptime: process.uptime() }),
}

// 不需要鉴权的路由
const PUBLIC_ROUTES = new Set(['GET /swagger', 'GET /openapi.json', 'GET /health'])

function checkAuth(req: Request, routeKey: string): Response | null {
  if (!config.apiKey) return null
  if (PUBLIC_ROUTES.has(routeKey)) return null

  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (token === config.apiKey) return null

  return Response.json({ ok: false, error: '未授权，需要 Authorization: Bearer <api-key>' }, { status: 401 })
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const method = req.method.toUpperCase()
  const path = url.pathname

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const key = `${method} ${path}`
  const handler = routes[key]

  if (!handler) {
    return Response.json({ ok: false, error: `未知路由: ${method} ${path}` }, { status: 404, headers: CORS_HEADERS })
  }

  // 鉴权检查
  const authError = checkAuth(req, key)
  if (authError) {
    for (const [k, v] of Object.entries(CORS_HEADERS)) authError.headers.set(k, v)
    return authError
  }

  try {
    let body: any = {}
    if (method === 'POST' && req.headers.get('content-type')?.includes('json')) {
      body = await req.json().catch(() => ({}))
    }
    const response = await handler(body)
    for (const [k, v] of Object.entries(CORS_HEADERS)) {
      response.headers.set(k, v)
    }
    return response
  } catch (e: any) {
    return Response.json({ ok: false, error: e.message }, { status: 500, headers: CORS_HEADERS })
  }
}

export function getRouteDefinitions() {
  return Object.keys(routes).map((key) => {
    const [method, path] = key.split(' ')
    return { method, path }
  })
}
