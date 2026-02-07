import { getRouteDefinitions } from './routes.js'

function generateOpenAPISpec(): object {
  const routes = getRouteDefinitions()

  const paths: Record<string, any> = {}
  for (const { method, path } of routes) {
    if (path === '/swagger' || path === '/openapi.json') continue

    const lowerMethod = method.toLowerCase()
    paths[path] = {
      ...(paths[path] ?? {}),
      [lowerMethod]: {
        summary: getRouteSummary(path),
        tags: [getRouteTag(path)],
        ...(lowerMethod === 'post'
          ? {
              requestBody: {
                content: {
                  'application/json': {
                    schema: { type: 'object' },
                  },
                },
              },
            }
          : {}),
        responses: {
          200: {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    data: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    }
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'terminal-farm API',
      version: '0.1.0',
      description: 'QQ/WeChat Farm Automation HTTP API',
    },
    paths,
  }
}

function getRouteTag(path: string): string {
  const segment = path.split('/')[1]
  return segment ?? 'other'
}

function getRouteSummary(path: string): string {
  const summaries: Record<string, string> = {
    '/account/list': '获取所有账号状态',
    '/account/add': '添加账号',
    '/account/remove': '移除账号',
    '/farm/status': '获取农场状态',
    '/farm/harvest': '手动收获',
    '/farm/replant': '手动换种',
    '/friend/list': '好友列表+巡查状态',
    '/friend/patrol': '触发好友巡查',
    '/system/logs': '获取最近日志',
    '/system/config': '获取运行时配置',
    '/system/version': '获取版本信息',
  }
  return summaries[path] ?? path
}

const SWAGGER_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>terminal-farm API</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({ url: '/openapi.json', dom_id: '#swagger-ui' })
  </script>
</body>
</html>`

export async function handleSwagger(): Promise<Response> {
  return new Response(SWAGGER_HTML, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

export async function handleOpenAPISpec(): Promise<Response> {
  return Response.json(generateOpenAPISpec())
}
