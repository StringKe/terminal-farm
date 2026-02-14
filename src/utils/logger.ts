import { type WriteStream, createWriteStream, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { getDateKey, getDateTime } from './format.js'

export type LogEntry = {
  timestamp: string
  tag: string
  message: string
  level: 'info' | 'warn' | 'error'
}

type LogListener = (entry: LogEntry) => void

const LOG_DIR = join(process.cwd(), 'logs')
const MAX_RING_SIZE = 500

let stream: WriteStream | null = null
let currentDateKey = ''
let disabled = false
const ringBuffer: LogEntry[] = []
const listeners = new Set<LogListener>()

function ensureStream(): void {
  if (disabled) return
  const dateKey = getDateKey()
  if (stream && dateKey === currentDateKey) return
  if (stream) {
    stream.end()
    stream = null
  }
  try {
    mkdirSync(LOG_DIR, { recursive: true })
    stream = createWriteStream(join(LOG_DIR, `${dateKey}.log`), { flags: 'a', encoding: 'utf8' })
    currentDateKey = dateKey
  } catch {
    disabled = true
  }
}

function pushEntry(entry: LogEntry): void {
  ringBuffer.push(entry)
  if (ringBuffer.length > MAX_RING_SIZE) ringBuffer.shift()
  for (const fn of listeners) {
    try {
      fn(entry)
    } catch {}
  }

  ensureStream()
  if (stream) {
    const level = entry.level === 'info' ? 'INFO' : entry.level === 'warn' ? 'WARN' : 'ERROR'
    stream.write(`[${entry.timestamp}] [${level}] [${entry.tag}] ${entry.message}\n`)
  }
}

export function log(tag: string, msg: string): void {
  const entry: LogEntry = { timestamp: getDateTime(), tag, message: msg, level: 'info' }
  pushEntry(entry)
}

export function logWarn(tag: string, msg: string): void {
  const entry: LogEntry = { timestamp: getDateTime(), tag, message: `⚠ ${msg}`, level: 'warn' }
  pushEntry(entry)
}

export function getLogRingBuffer(): readonly LogEntry[] {
  return ringBuffer
}

export function getRecentLogs(limit = 50, offset = 0): LogEntry[] {
  const start = Math.max(0, ringBuffer.length - offset - limit)
  const end = Math.max(0, ringBuffer.length - offset)
  return ringBuffer.slice(start, end)
}

export function onLog(fn: LogListener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// Runtime hint
let hintPrinted = false
export async function emitRuntimeHint(force = false): Promise<void> {
  const { decodeRuntimeHint } = await import('../config/constants.js')
  if (!force) {
    if (Math.random() > 0.033) return
    if (hintPrinted && Math.random() > 0.2) return
  }
  log('声明', decodeRuntimeHint())
  hintPrinted = true
}

export function cleanupLogger(): void {
  if (stream) {
    stream.end()
    stream = null
  }
}
