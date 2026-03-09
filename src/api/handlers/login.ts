import { addAccount } from '../../core/account.js'

export async function handleLoginQRCreate(): Promise<Response> {
  return Response.json({ ok: false, error: '扫码登录已停用，请使用 Code 登录' }, { status: 410 })
}

export async function handleLoginQRPoll(body: any): Promise<Response> {
  return Response.json({ ok: false, error: '扫码登录已停用，请使用 Code 登录' }, { status: 410 })
}

export async function handleLoginCode(body: any): Promise<Response> {
  const { platform, code } = body ?? {}
  if (!code) {
    return Response.json({ ok: false, error: '缺少 code' }, { status: 400 })
  }
  const p = platform === 'wx' ? 'wx' : 'qq'
  try {
    const account = await addAccount(p, code)
    return Response.json({ ok: true, data: { id: account.id } })
  } catch (e: any) {
    return Response.json({ ok: false, error: e.message }, { status: 500 })
  }
}
