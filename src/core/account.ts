import { config } from '../config/index.js'
import { type QRLoginInfo, clearCode, loadCode, pollQRScanResult, requestQRLogin, saveCode } from '../protocol/login.js'
import { accountStore, registerSessionStore, removeSessionStore } from '../store/index.js'
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
  const session = new Session(id, platform, {
    onReconnectFailed: (failedId) => {
      logWarn('账号', `账号 ${failedId} 重连失败，自动移除`)
      removeAccount(failedId)
    },
  })

  // 注册 store 到全局 registry，确保 UI 读取同一个实例
  registerSessionStore(id, session.store)

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
    logWarn('账号', `连接失败: ${e.message}`)
    removeAccount(id)
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

export async function loginWithQR(): Promise<{
  qrInfo: QRLoginInfo
  poll: () => Promise<Session>
}> {
  log('扫码登录', '正在获取二维码...')
  const qrInfo = await requestQRLogin()
  log('扫码登录', '二维码已生成，等待扫码...')
  return {
    qrInfo,
    poll: async () => {
      const code = await pollQRScanResult(qrInfo.loginCode)
      log('扫码登录', `获取成功，code=${code.substring(0, 8)}...`)
      return addAccount('qq', code)
    },
  }
}

export function stopAll(): void {
  for (const session of sessions.values()) {
    session.stop()
  }
  sessions.clear()
}
