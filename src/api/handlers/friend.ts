import { getSession } from '../../core/account.js'
import { getSessionStore } from '../../store/index.js'

export async function handleFriendList(body: any): Promise<Response> {
  const { accountId } = body ?? {}
  if (!accountId) return Response.json({ ok: false, error: '缺少 accountId' }, { status: 400 })

  const store = getSessionStore(accountId)
  return Response.json({
    ok: true,
    data: {
      friends: store.state.friends,
      progress: store.state.friendPatrolProgress,
      stats: store.state.friendStats,
    },
  })
}

export async function handleFriendPatrol(body: any): Promise<Response> {
  const { accountId } = body ?? {}
  if (!accountId) return Response.json({ ok: false, error: '缺少 accountId' }, { status: 400 })

  const session = getSession(accountId)
  if (!session) return Response.json({ ok: false, error: '账号未找到' }, { status: 404 })

  try {
    session.scheduler.trigger('friend-check', 0)
    return Response.json({ ok: true })
  } catch (e: any) {
    return Response.json({ ok: false, error: e.message }, { status: 500 })
  }
}
