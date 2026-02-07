import { config } from '../config/index.js'
import { clearCode, getQQFarmCodeByScan, loadCode, saveCode } from '../protocol/login.js'
import { accountStore, removeSessionStore } from '../store/index.js'
import { log, logWarn } from '../utils/logger.js'
import { Session } from './session.js'

const sessions = new Map<string, Session>()
let nextId = 1

export function getSessions(): Map<string, Session> {
  return sessions
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id)
}

export async function addAccount(platform: 'qq' | 'wx', code: string): Promise<Session> {
  const id = `account-${nextId++}`
  const session = new Session(id, platform)

  accountStore.addAccount({
    id,
    platform,
    code,
    name: '连接中...',
    level: 0,
    status: 'connecting',
  })

  sessions.set(id, session)

  try {
    await session.start(code)
    const user = session.conn.userState
    accountStore.updateAccount(id, {
      name: user.name,
      level: user.level,
      status: 'online',
    })

    if (platform === 'qq') saveCode(code, platform)

    return session
  } catch (e: any) {
    accountStore.updateAccount(id, { status: 'error' })
    logWarn('账号', `连接失败: ${e.message}`)
    throw e
  }
}

export function removeAccount(id: string): void {
  const session = sessions.get(id)
  if (session) {
    session.stop()
    sessions.delete(id)
  }
  accountStore.removeAccount(id)
  removeSessionStore(id)
}

export async function autoLogin(): Promise<Session | null> {
  // Try loading saved code for QQ platform
  if (config.platform === 'qq') {
    const savedCode = loadCode('qq')
    if (savedCode) {
      log('持久化', `使用保存的 code=${savedCode.substring(0, 8)}...`)
      try {
        return await addAccount('qq', savedCode)
      } catch {
        log('持久化', '保存的 code 已失效，清除并回退到扫码登录...')
        clearCode()
      }
    }
  }
  return null
}

export async function loginWithQR(): Promise<Session> {
  log('扫码登录', '正在获取二维码...')
  const code = await getQQFarmCodeByScan()
  log('扫码登录', `获取成功，code=${code.substring(0, 8)}...`)
  return addAccount('qq', code)
}

export function stopAll(): void {
  for (const session of sessions.values()) {
    session.stop()
  }
  sessions.clear()
}
