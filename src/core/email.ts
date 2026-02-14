import { getItemName } from '../config/game-data.js'
import type { Connection } from '../protocol/connection.js'
import { types } from '../protocol/proto-loader.js'
import { log, logWarn } from '../utils/logger.js'
import { toNum } from '../utils/long.js'

const EMAIL_TYPE_SYSTEM = 1

export class EmailManager {
  private initTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private conn: Connection) {}

  async checkAndClaimEmails(): Promise<void> {
    try {
      const body = types.GetEmailListRequest.encode(
        types.GetEmailListRequest.create({ email_type: EMAIL_TYPE_SYSTEM }),
      ).finish()
      const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.emailpb.EmailService', 'GetEmailList', body)
      const reply = types.GetEmailListReply.decode(replyBody) as any
      const emails = reply.emails || []

      const claimable = emails.filter((e: any) => e.has_reward)
      if (!claimable.length) return

      log('邮件', `发现 ${claimable.length} 封可领取奖励的邮件`)
      const emailIds = claimable.map((e: any) => e.email_id)
      await this.batchClaim(emailIds)
    } catch (e: any) {
      logWarn('邮件', `检查邮件失败: ${e.message}`)
    }
  }

  private async batchClaim(emailIds: string[]): Promise<void> {
    try {
      const body = types.BatchClaimEmailRequest.encode(
        types.BatchClaimEmailRequest.create({
          email_type: EMAIL_TYPE_SYSTEM,
          email_ids: emailIds,
        }),
      ).finish()
      const { body: replyBody } = await this.conn.sendMsgAsync('gamepb.emailpb.EmailService', 'BatchClaimEmail', body)
      const reply = types.BatchClaimEmailReply.decode(replyBody) as any
      const rewards = reply.rewards || []
      if (rewards.length > 0) {
        const summary = rewards
          .map((r: any) => {
            const id = toNum(r.id)
            const count = toNum(r.count)
            if (id === 1) return `金币${count}`
            if (id === 2) return `经验${count}`
            return `${getItemName(id)}(${id})x${count}`
          })
          .join('/')
        log('邮件', `领取 ${emailIds.length} 封邮件奖励: ${summary}`)
      } else {
        log('邮件', `已领取 ${emailIds.length} 封邮件`)
      }
    } catch (e: any) {
      logWarn('邮件', `批量领取邮件奖励失败: ${e.message}`)
    }
  }

  private onNewEmail = (): void => {
    log('邮件', '收到新邮件推送，检查可领取奖励...')
    setTimeout(() => this.checkAndClaimEmails(), 1000)
  }

  start(): void {
    this.conn.on('newEmailNotify', this.onNewEmail)
    this.initTimer = setTimeout(() => {
      this.initTimer = null
      this.checkAndClaimEmails()
    }, 8000)
  }

  stop(): void {
    this.conn.off('newEmailNotify', this.onNewEmail)
    if (this.initTimer) {
      clearTimeout(this.initTimer)
      this.initTimer = null
    }
  }
}
