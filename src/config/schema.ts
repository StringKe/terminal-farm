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
  forceLowestLevelCrop: z.boolean().default(false),
  autoReplantMode: z.union([z.literal('levelup'), z.literal('always'), z.literal(false)]).default('levelup'),
  replantProtectPercent: z.number().min(0).max(100).default(80),
  deviceInfo: deviceInfoSchema,
  apiEnabled: z.boolean().default(false),
  apiPort: z.number().int().positive().default(3000),
})

export type DeviceInfo = z.infer<typeof deviceInfoSchema>
export type AppConfig = z.infer<typeof appConfigSchema>
