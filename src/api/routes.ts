import { handleAccountAdd, handleAccountList, handleAccountRemove } from './handlers/account.js'
import { handleFarmHarvest, handleFarmReplant, handleFarmStatus } from './handlers/farm.js'
import { handleFriendList, handleFriendPatrol } from './handlers/friend.js'
import { handleStatsHistory, handleStatsSummary } from './handlers/stats.js'
import { handleSystemConfig, handleSystemLogs, handleSystemVersion } from './handlers/system.js'
import { handleOpenAPISpec, handleSwagger } from './swagger.js'

type RouteHandler = (body: any) => Promise<Response>

const routes: Record<string, RouteHandler> = {
  'POST /account/list': handleAccountList,
  'POST /account/add': handleAccountAdd,
  'POST /account/remove': handleAccountRemove,
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
}

export async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const method = req.method.toUpperCase()
  const path = url.pathname

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const key = `${method} ${path}`
  const handler = routes[key]

  if (!handler) {
    return Response.json({ ok: false, error: `未知路由: ${method} ${path}` }, { status: 404, headers: corsHeaders })
  }

  try {
    let body: any = {}
    if (method === 'POST' && req.headers.get('content-type')?.includes('json')) {
      body = await req.json().catch(() => ({}))
    }
    const response = await handler(body)
    // Add CORS headers to response
    for (const [k, v] of Object.entries(corsHeaders)) {
      response.headers.set(k, v)
    }
    return response
  } catch (e: any) {
    return Response.json({ ok: false, error: e.message }, { status: 500, headers: corsHeaders })
  }
}

export function getRouteDefinitions() {
  return Object.keys(routes).map((key) => {
    const [method, path] = key.split(' ')
    return { method, path }
  })
}
