import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import defaultVersionData from '../../.version.json'
import type { AppConfig } from './schema.js'

export const versionData = (() => {
  const cwdVersionFile = join(process.cwd(), '.version.json')
  if (existsSync(cwdVersionFile)) {
    try {
      return JSON.parse(readFileSync(cwdVersionFile, 'utf8'))
    } catch {}
  }
  return defaultVersionData
})()

const serverUrl = versionData.game?.serverUrl ?? 'wss://gate-obt.nqf.qq.com/prod/ws'
const clientVersion = versionData.app?.clientVersion ?? '1.6.0.14_20251224'

export const config: AppConfig = {
  serverUrl,
  clientVersion,
  platform: 'qq',
  os: 'iOS',
  heartbeatInterval: 25000,
  farmCheckInterval: 1000,
  friendCheckInterval: 10000,
  deviceInfo: {
    client_version: clientVersion,
    sys_software: 'iOS 26.2.1',
    network: 'wifi',
    memory: '7672',
    device_id: 'iPhone X<iPhone18,3>',
  },
  apiEnabled: false,
  apiPort: 3000,
}

export function updateConfig(partial: Partial<AppConfig>): void {
  Object.assign(config, partial)
}

export type { AppConfig, DeviceInfo, AccountConfig } from './schema.js'
export { accountConfigSchema } from './schema.js'
export { loadAccountConfig, saveAccountConfig, updateAccountConfig, getDefaultAccountConfig } from './account-config.js'
export {
  PlantPhase,
  PHASE_NAMES,
  OP_NAMES,
  NORMAL_FERTILIZER_ID,
  ORGANIC_FERTILIZER_ID,
  GOLD_ITEM_ID,
  SEED_SHOP_ID,
} from './constants.js'
export {
  loadConfigs,
  getLevelExpTable,
  getLevelExpProgress,
  getPlantName,
  getPlantNameBySeedId,
  getPlantExp,
  getPlantGrowTime,
  formatGrowTime,
  getFruitName,
  getItemName,
  getSeedIdByPlantId,
  getPlantById,
} from './game-data.js'
