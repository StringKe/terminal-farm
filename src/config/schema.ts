import { z } from 'zod'

export const deviceInfoSchema = z.object({
  client_version: z.string(),
  sys_software: z.string(),
  network: z.string(),
  memory: z.string(),
  device_id: z.string(),
})

export const appConfigSchema = z.object({
  serverUrl: z.string().url(),
  clientVersion: z.string(),
  platform: z.enum(['qq', 'wx']).default('qq'),
  os: z.string().default('iOS'),
  heartbeatInterval: z.number().int().positive().default(25000),
  farmCheckInterval: z.number().int().positive().default(1000),
  friendCheckInterval: z.number().int().positive().default(10000),
  deviceInfo: deviceInfoSchema,
  apiEnabled: z.boolean().default(false),
  apiPort: z.number().int().positive().default(3000),
})

export const accountConfigSchema = z.object({
  manualSeedId: z.number().int().nonnegative().default(0),
  forceLowestLevelCrop: z.boolean().default(false),
  autoReplantMode: z.union([z.literal('levelup'), z.literal('always'), z.literal(false)]).default('levelup'),
  replantProtectPercent: z.number().min(0).max(100).default(80),
  useNormalFertilizer: z.boolean().default(true),
  autoRefillNormalFertilizer: z.boolean().default(false),
  useOrganicFertilizer: z.boolean().default(false),
  autoRefillOrganicFertilizer: z.boolean().default(false),
  enablePutBadThings: z.boolean().default(false),
  autoClaimFreeGifts: z.boolean().default(true),
  autoUseGiftPacks: z.boolean().default(true),
  enableHumanMode: z.boolean().default(true),
  humanModeIntensity: z.enum(['low', 'medium', 'high']).default('medium'),
  enableIllustratedUnlock: z.boolean().default(false),
})

export type DeviceInfo = z.infer<typeof deviceInfoSchema>
export type AppConfig = z.infer<typeof appConfigSchema>
export type AccountConfig = z.infer<typeof accountConfigSchema>
