import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { config } from '../config/index.js'
import type { Connection } from '../protocol/connection.js'
import { types } from '../protocol/proto-loader.js'
import { log, logWarn, sleep } from '../utils/logger.js'
import { toLong } from '../utils/long.js'

const SHARE_FILE = join(process.cwd(), 'share.txt')
const INVITE_REQUEST_DELAY = 2000

function parseShareLink(link: string) {
  const queryStr = link.startsWith('?') ? link.slice(1) : link
  const params = new URLSearchParams(queryStr)
  return { uid: params.get('uid'), openid: params.get('openid'), shareSource: params.get('share_source') }
}

function readShareFile(): { uid: string; openid: string; shareSource: string | null }[] {
  if (!existsSync(SHARE_FILE)) return []
  try {
    const content = readFileSync(SHARE_FILE, 'utf8')
    const lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && l.includes('openid='))
    const invites: { uid: string; openid: string; shareSource: string | null }[] = []
    const seenUids = new Set<string>()
    for (const line of lines) {
      const parsed = parseShareLink(line)
      if (parsed.openid && parsed.uid && !seenUids.has(parsed.uid)) {
        seenUids.add(parsed.uid)
        invites.push({ uid: parsed.uid, openid: parsed.openid, shareSource: parsed.shareSource })
      }
    }
    return invites
  } catch (e: any) {
    logWarn('邀请', `读取 share.txt 失败: ${e.message}`)
    return []
  }
}

function clearShareFile(): void {
  try {
    writeFileSync(SHARE_FILE, '', 'utf8')
    log('邀请', '已清空 share.txt')
  } catch {}
}

export async function processInviteCodes(conn: Connection): Promise<void> {
  if (config.platform !== 'wx') {
    log('邀请', '当前为 QQ 环境，跳过邀请码处理（仅微信支持）')
    return
  }
  const invites = readShareFile()
  if (!invites.length) return
  log('邀请', `读取到 ${invites.length} 个邀请码（已去重），开始逐个处理...`)
  let successCount = 0
  let failCount = 0
  for (let i = 0; i < invites.length; i++) {
    const invite = invites[i]
    try {
      const body = types.ReportArkClickRequest.encode(
        types.ReportArkClickRequest.create({
          sharer_id: toLong(Number(invite.uid) || 0),
          sharer_open_id: invite.openid,
          share_cfg_id: toLong(Number(invite.shareSource) || 0),
          scene_id: '1256',
        }),
      ).finish()
      await conn.sendMsgAsync('gamepb.userpb.UserService', 'ReportArkClick', body)
      successCount++
      log('邀请', `[${i + 1}/${invites.length}] 已向 uid=${invite.uid} 发送好友申请`)
    } catch (e: any) {
      failCount++
      logWarn('邀请', `[${i + 1}/${invites.length}] 向 uid=${invite.uid} 发送申请失败: ${e.message}`)
    }
    if (i < invites.length - 1) await sleep(INVITE_REQUEST_DELAY)
  }
  log('邀请', `处理完成: 成功 ${successCount}, 失败 ${failCount}`)
  clearShareFile()
}
