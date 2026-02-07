import { log } from '../utils/logger.js'
import { handleRequest } from './routes.js'

let server: ReturnType<typeof Bun.serve> | null = null

export function startApiServer(port: number): void {
  if (server) return

  server = Bun.serve({
    port,
    fetch: handleRequest,
  })

  log('API', `HTTP 服务已启动: http://localhost:${port}  Swagger: http://localhost:${port}/swagger`)
}

export function stopApiServer(): void {
  if (server) {
    server.stop()
    server = null
    log('API', 'HTTP 服务已停止')
  }
}
