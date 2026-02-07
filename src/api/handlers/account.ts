import { addAccount, removeAccount } from '../../core/account.js'
import { accountStore } from '../../store/index.js'

export async function handleAccountList(): Promise<Response> {
  const accounts = accountStore.getAccounts().map((a) => ({
    id: a.id,
    platform: a.platform,
    name: a.name,
    level: a.level,
    status: a.status,
  }))
  return Response.json({ ok: true, data: accounts })
}

export async function handleAccountAdd(body: any): Promise<Response> {
  const { platform, code } = body ?? {}
  if (!platform || !code) {
    return Response.json({ ok: false, error: '缺少 platform 或 code' }, { status: 400 })
  }
  if (platform !== 'qq' && platform !== 'wx') {
    return Response.json({ ok: false, error: 'platform 必须是 qq 或 wx' }, { status: 400 })
  }
  try {
    const session = await addAccount(platform, code)
    return Response.json({ ok: true, data: { id: session.id } })
  } catch (e: any) {
    return Response.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function handleAccountRemove(body: any): Promise<Response> {
  const { id } = body ?? {}
  if (!id) return Response.json({ ok: false, error: '缺少 id' }, { status: 400 })
  removeAccount(id)
  return Response.json({ ok: true })
}
