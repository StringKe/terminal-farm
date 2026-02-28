import { addAccount } from '../../core/account.js'
import { pollQRScanResult, requestQRLogin } from '../../protocol/login.js'

// 活跃的 QR 登录会话（loginCode -> state）
const qrSessions = new Map<string, { loginCode: string; url: string; createdAt: number }>()

// 自动清理过期 QR 会话（3 分钟）
const QR_TTL_MS = 180_000

function cleanExpiredSessions(): void {
  const now = Date.now()
  for (const [key, session] of qrSessions) {
    if (now - session.createdAt > QR_TTL_MS) qrSessions.delete(key)
  }
}

export async function handleLoginQRCreate(): Promise<Response> {
  cleanExpiredSessions()
  const qrInfo = await requestQRLogin()
  qrSessions.set(qrInfo.loginCode, {
    loginCode: qrInfo.loginCode,
    url: qrInfo.url,
    createdAt: Date.now(),
  })
  return Response.json({
    ok: true,
    data: {
      loginCode: qrInfo.loginCode,
      url: qrInfo.url,
      qrText: qrInfo.qrText,
    },
  })
}

export async function handleLoginQRPoll(body: any): Promise<Response> {
  const { loginCode, platform } = body ?? {}
  if (!loginCode) {
    return Response.json({ ok: false, error: '缺少 loginCode' }, { status: 400 })
  }

  const session = qrSessions.get(loginCode)
  if (!session) {
    return Response.json({ ok: false, error: 'loginCode 不存在或已过期' }, { status: 404 })
  }

  try {
    const code = await pollQRScanResult(loginCode, { pollIntervalMs: 2000, timeoutMs: 10000 })
    qrSessions.delete(loginCode)
    const p = platform === 'wx' ? 'wx' : 'qq'
    const account = await addAccount(p, code)
    return Response.json({ ok: true, data: { id: account.id, code } })
  } catch (e: any) {
    if (e.message.includes('超时')) {
      // 还在等待扫码，返回 pending 状态
      return Response.json({ ok: true, data: { status: 'waiting' } })
    }
    qrSessions.delete(loginCode)
    return Response.json({ ok: false, error: e.message }, { status: 500 })
  }
}
