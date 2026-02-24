import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { accountConfigSchema } from './schema.js'
import type { AccountConfig } from './schema.js'
import { paths } from './paths.js'

const cache = new Map<number, AccountConfig>()

export function getDefaultAccountConfig(): AccountConfig {
  return accountConfigSchema.parse({})
}

export function loadAccountConfig(gid: number): AccountConfig {
  const cached = cache.get(gid)
  if (cached) return cached

  const path = paths.accountConfig(gid)
  let config: AccountConfig
  if (existsSync(path)) {
    try {
      const raw = JSON.parse(readFileSync(path, 'utf8'))
      config = accountConfigSchema.parse(raw)
    } catch {
      config = getDefaultAccountConfig()
    }
  } else {
    config = getDefaultAccountConfig()
  }
  cache.set(gid, config)
  return config
}

export function saveAccountConfig(gid: number, config: AccountConfig): void {
  const path = paths.accountConfig(gid)
  writeFileSync(path, JSON.stringify(config, null, 2), 'utf8')
  cache.set(gid, config)
}

export function updateAccountConfig(gid: number, partial: Partial<AccountConfig>): AccountConfig {
  const current = loadAccountConfig(gid)
  const updated = accountConfigSchema.parse({ ...current, ...partial })
  saveAccountConfig(gid, updated)
  return updated
}
