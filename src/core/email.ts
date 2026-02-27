import type { Connection } from '../protocol/connection.js'
import { types } from '../protocol/proto-loader.js'
import type { ScopedLogger } from '../utils/logger.js'
import { formatRewards } from '../utils/reward.js'
import type { TaskScheduler } from './scheduler.js'

const EMAIL_TYPE_SYSTEM = 1

export class EmailManager {
  constructor(
    private conn: Connection,
    private logger: ScopedLogger,
    private scheduler: TaskScheduler,
  ) {}

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

      this.logger.log('邮件', `发现 ${claimable.length} 封可领取奖励的邮件`)
      const emailIds = claimable.map((e: any) => e.email_id)
      await this.batchClaim(emailIds)
    } catch (e: any) {
      this.logger.logWarn('邮件', `检查邮件失败: ${e.message}`)
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
        this.logger.log('邮件', `领取 ${emailIds.length} 封邮件奖励: ${formatRewards(rewards)}`)
      } else {
        this.logger.log('邮件', `已领取 ${emailIds.length} 封邮件`)
      }
    } catch (e: any) {
      this.logger.logWarn('邮件', `批量领取邮件奖励失败: ${e.message}`)
    }
  }

  private onNewEmail = (): void => {
    this.logger.log('邮件', '收到新邮件推送，检查可领取奖励...')
    this.scheduler.trigger('email-check', 1000)
  }

  registerTasks(): void {
    this.scheduler.every('email-check', () => this.checkAndClaimEmails(), {
      intervalMs: 3600_000,
      startDelayMs: 8000,
      name: '邮件领取',
    })
    this.conn.on('newEmailNotify', this.onNewEmail)
  }
}
