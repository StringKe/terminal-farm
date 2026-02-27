import { getSession } from '../../core/account.js'
import { getSessionStore } from '../../store/index.js'

export async function handleFarmStatus(body: any): Promise<Response> {
  const { accountId } = body ?? {}
  if (!accountId) return Response.json({ ok: false, error: '缺少 accountId' }, { status: 400 })

  const store = getSessionStore(accountId)
  return Response.json({
    ok: true,
    data: {
      lands: store.state.lands,
      user: store.state.user,
      bag: store.state.bag,
      weather: store.state.weather,
      schedulerStatus: store.state.schedulerStatus,
    },
  })
}

export async function handleFarmHarvest(body: any): Promise<Response> {
  const { accountId } = body ?? {}
  if (!accountId) return Response.json({ ok: false, error: '缺少 accountId' }, { status: 400 })

  const session = getSession(accountId)
  if (!session) return Response.json({ ok: false, error: '账号未找到' }, { status: 404 })

  try {
    await session.farm.checkFarm()
    return Response.json({ ok: true })
  } catch (e: any) {
    return Response.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function handleFarmReplant(body: any): Promise<Response> {
  const { accountId } = body ?? {}
  if (!accountId) return Response.json({ ok: false, error: '缺少 accountId' }, { status: 400 })

  const session = getSession(accountId)
  if (!session) return Response.json({ ok: false, error: '账号未找到' }, { status: 404 })

  try {
    await session.farm.checkFarm()
    return Response.json({ ok: true })
  } catch (e: any) {
    return Response.json({ ok: false, error: e.message }, { status: 500 })
  }
}
