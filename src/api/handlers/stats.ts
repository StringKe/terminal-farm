import { getSessionStore } from '../../store/index.js'
import { aggregateStats, loadHistory } from '../../store/stats.js'

export async function handleStatsSummary(body: any): Promise<Response> {
  const { accountId } = body ?? {}
  if (!accountId) return Response.json({ ok: false, error: '缺少 accountId' }, { status: 400 })

  const store = getSessionStore(accountId)
  const daily = store.state.dailyStats

  return Response.json({
    ok: true,
    data: {
      today: daily,
      week: aggregateStats('week', daily),
      month: aggregateStats('month', daily),
      total: aggregateStats('total', daily),
    },
  })
}

export async function handleStatsHistory(_body: any): Promise<Response> {
  const history = loadHistory()
  return Response.json({ ok: true, data: history })
}
