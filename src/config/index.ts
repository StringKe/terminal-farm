import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AppConfig } from './schema.js'

const VERSION_FILE = join(import.meta.dir, '..', '..', '.version.json')

function loadVersionConfig(): { serverUrl: string; clientVersion: string } {
  try {
    const data = JSON.parse(readFileSync(VERSION_FILE, 'utf8'))
    return {
      serverUrl: data.game?.serverUrl ?? 'wss://gate-obt.nqf.qq.com/prod/ws',
      clientVersion: data.app?.clientVersion ?? '1.6.0.14_20251224',
    }
  } catch {
    return {
      serverUrl: 'wss://gate-obt.nqf.qq.com/prod/ws',
      clientVersion: '1.6.0.14_20251224',
    }
  }
}

const versionConfig = loadVersionConfig()

export const config: AppConfig = {
  serverUrl: versionConfig.serverUrl,
  clientVersion: versionConfig.clientVersion,
  platform: 'qq',
  os: 'iOS',
  heartbeatInterval: 25000,
  farmCheckInterval: 1000,
  friendCheckInterval: 10000,
  forceLowestLevelCrop: false,
  autoReplantMode: 'levelup',
  replantProtectPercent: 80,
  deviceInfo: {
    client_version: versionConfig.clientVersion,
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

export type { AppConfig, DeviceInfo } from './schema.js'
export { PlantPhase, PHASE_NAMES, OP_NAMES, NORMAL_FERTILIZER_ID, GOLD_ITEM_ID, SEED_SHOP_ID } from './constants.js'
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
