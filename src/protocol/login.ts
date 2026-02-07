import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import axios from 'axios'
import qrcodeTerminal from 'qrcode-terminal'

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const QUA = 'V1_HT5_QDT_0.70.2209190_x64_0_DEV_D'
const FARM_APP_ID = '1112386029'

const CODE_FILE = join(process.cwd(), '.farm-code.json')

function getHeaders() {
  return {
    qua: QUA,
    host: 'q.qq.com',
    accept: 'application/json',
    'content-type': 'application/json',
    'user-agent': CHROME_UA,
  }
}

async function requestLoginCode(): Promise<{ loginCode: string; url: string }> {
  const response = await axios.get('https://q.qq.com/ide/devtoolAuth/GetLoginCode', { headers: getHeaders() })
  const { code, data } = response.data || {}
  if (+code !== 0 || !data?.code) throw new Error('获取QQ扫码登录码失败')
  return {
    loginCode: data.code,
    url: `https://h5.qzone.qq.com/qqq/code/${data.code}?_proxy=1&from=ide`,
  }
}

async function queryScanStatus(loginCode: string): Promise<{ status: string; ticket?: string }> {
  const response = await axios.get(
    `https://q.qq.com/ide/devtoolAuth/syncScanSateGetTicket?code=${encodeURIComponent(loginCode)}`,
    { headers: getHeaders() },
  )
  if (response.status !== 200) return { status: 'Error' }
  const { code, data } = response.data || {}
  if (+code === 0) {
    if (+data?.ok !== 1) return { status: 'Wait' }
    return { status: 'OK', ticket: data.ticket || '' }
  }
  if (+code === -10003) return { status: 'Used' }
  return { status: 'Error' }
}

async function getAuthCode(ticket: string): Promise<string> {
  const response = await axios.post(
    'https://q.qq.com/ide/login',
    { appid: FARM_APP_ID, ticket },
    { headers: getHeaders() },
  )
  if (response.status !== 200 || !response.data?.code) throw new Error('获取农场登录 code 失败')
  return response.data.code
}

export async function getQQFarmCodeByScan(opts: { pollIntervalMs?: number; timeoutMs?: number } = {}): Promise<string> {
  const pollIntervalMs = Number(opts.pollIntervalMs) > 0 ? Number(opts.pollIntervalMs) : 2000
  const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : 180000

  const { loginCode, url } = await requestLoginCode()

  console.log('')
  console.log('[扫码登录] 请用 QQ 扫描下方二维码确认登录:')
  qrcodeTerminal.generate(url, { small: true })
  console.log(
    `[扫码登录] 若二维码显示异常，可直接打开链接: https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`,
  )
  console.log('')

  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const status = await queryScanStatus(loginCode)
    if (status.status === 'OK') return getAuthCode(status.ticket!)
    if (status.status === 'Used') throw new Error('二维码已失效，请重试')
    if (status.status === 'Error') throw new Error('扫码状态查询失败，请重试')
    await new Promise((r) => setTimeout(r, pollIntervalMs))
  }
  throw new Error('扫码超时，请重试')
}

export function saveCode(code: string, platform: string): void {
  try {
    writeFileSync(CODE_FILE, JSON.stringify({ code, platform, savedAt: Date.now() }))
  } catch {}
}

export function loadCode(platform: string): string | null {
  try {
    if (!existsSync(CODE_FILE)) return null
    const data = JSON.parse(readFileSync(CODE_FILE, 'utf-8'))
    if (data.code && data.platform === platform) return data.code
    return null
  } catch {
    return null
  }
}

export function clearCode(): void {
  try {
    unlinkSync(CODE_FILE)
  } catch {}
}
