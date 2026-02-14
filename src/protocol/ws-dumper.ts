import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { types } from './proto-loader.js'

const DUMP_DIR = join(process.cwd(), 'dumps')

/** 已知的 notify body 解码器映射（event.message_type 关键字 → types key） */
const NOTIFY_DECODERS: Record<string, string> = {
  LandsNotify: 'LandsNotify',
  BasicNotify: 'BasicNotify',
  KickoutNotify: 'KickoutNotify',
  FriendApplicationReceivedNotify: 'FriendApplicationReceivedNotify',
  FriendAddedNotify: 'FriendAddedNotify',
  ItemNotify: 'ItemNotify',
  GoodsUnlockNotify: 'GoodsUnlockNotify',
  TaskInfoNotify: 'TaskInfoNotify',
}

/** 已知的 response body 解码器映射（service.method → types key） */
const RESPONSE_DECODERS: Record<string, string> = {
  'gamepb.userpb.UserService.Login': 'LoginReply',
  'gamepb.userpb.UserService.Heartbeat': 'HeartbeatReply',
  'gamepb.userpb.UserService.ReportArkClick': 'ReportArkClickReply',
  'gamepb.plantpb.PlantService.AllLands': 'AllLandsReply',
  'gamepb.plantpb.PlantService.Harvest': 'HarvestReply',
  'gamepb.plantpb.PlantService.WaterLand': 'WaterLandReply',
  'gamepb.plantpb.PlantService.WeedOut': 'WeedOutReply',
  'gamepb.plantpb.PlantService.Insecticide': 'InsecticideReply',
  'gamepb.plantpb.PlantService.RemovePlant': 'RemovePlantReply',
  'gamepb.plantpb.PlantService.PutInsects': 'PutInsectsReply',
  'gamepb.plantpb.PlantService.PutWeeds': 'PutWeedsReply',
  'gamepb.plantpb.PlantService.Fertilize': 'FertilizeReply',
  'gamepb.plantpb.PlantService.Plant': 'PlantReply',
  'gamepb.itempb.ItemService.Bag': 'BagReply',
  'gamepb.itempb.ItemService.Sell': 'SellReply',
  'gamepb.shoppb.ShopService.ShopProfiles': 'ShopProfilesReply',
  'gamepb.shoppb.ShopService.ShopInfo': 'ShopInfoReply',
  'gamepb.shoppb.ShopService.BuyGoods': 'BuyGoodsReply',
  'gamepb.friendpb.FriendService.GetAll': 'GetAllFriendsReply',
  'gamepb.friendpb.FriendService.GetApplications': 'GetApplicationsReply',
  'gamepb.friendpb.FriendService.AcceptFriends': 'AcceptFriendsReply',
  'gamepb.visitpb.VisitService.Enter': 'VisitEnterReply',
  'gamepb.visitpb.VisitService.Leave': 'VisitLeaveReply',
  'gamepb.taskpb.TaskService.TaskInfo': 'TaskInfoReply',
  'gamepb.taskpb.TaskService.ClaimTaskReward': 'ClaimTaskRewardReply',
  'gamepb.taskpb.TaskService.BatchClaimTaskReward': 'BatchClaimTaskRewardReply',
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/<>:"|?*\\]/g, '_')
}

function toJsonSafe(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj
  if (Buffer.isBuffer(obj) || obj instanceof Uint8Array) {
    return `<bytes:${obj.length}>`
  }
  if (Array.isArray(obj)) return obj.map(toJsonSafe)
  const result: Record<string, any> = {}
  for (const [k, v] of Object.entries(obj)) {
    result[k] = toJsonSafe(v)
  }
  return result
}

function tryDecodeBody(body: Uint8Array, typeKey: string): any | null {
  const decoder = types[typeKey]
  if (!decoder) return null
  try {
    const decoded = decoder.decode(body) as any
    return decoder.toObject(decoded, { longs: String, defaults: true })
  } catch {
    return null
  }
}

function writeDump(subdir: string, filename: string, data: any): void {
  const dir = join(DUMP_DIR, subdir)
  ensureDir(dir)
  const filepath = join(dir, `${sanitizeFilename(filename)}.json`)
  writeFileSync(filepath, JSON.stringify(data, null, 2))
}

/** 记录响应消息 (message_type=2) */
export function dumpResponse(meta: any, body: Uint8Array | null): void {
  try {
    const service = meta.service_name || 'unknown'
    const method = meta.method_name || 'unknown'
    const key = `${service}.${method}`

    const record: any = {
      _type: 'response',
      _key: key,
      _time: new Date().toISOString(),
      meta: toJsonSafe(meta),
    }

    const decoderKey = RESPONSE_DECODERS[key]
    if (body && decoderKey) {
      const decoded = tryDecodeBody(body, decoderKey)
      if (decoded) {
        record.body = decoded
      } else {
        record.body_raw = Buffer.from(body).toString('base64')
      }
    } else if (body) {
      record.body_raw = Buffer.from(body).toString('base64')
    }

    writeDump('response', key, record)
  } catch {}
}

/** 记录推送通知 (message_type=3) */
export function dumpNotify(eventType: string, eventBody: Uint8Array | null): void {
  try {
    const record: any = {
      _type: 'notify',
      _key: eventType,
      _time: new Date().toISOString(),
    }

    // 尝试匹配已知 notify 解码器
    let decoded: any = null
    for (const [keyword, typeKey] of Object.entries(NOTIFY_DECODERS)) {
      if (eventType.includes(keyword)) {
        decoded = eventBody ? tryDecodeBody(eventBody, typeKey) : null
        break
      }
    }

    if (decoded) {
      record.body = decoded
    } else if (eventBody) {
      record.body_raw = Buffer.from(eventBody).toString('base64')
    }

    writeDump('notify', eventType, record)
  } catch {}
}

/** 记录无法解码的原始消息 */
export function dumpRaw(buf: Buffer): void {
  try {
    const dir = join(DUMP_DIR, 'raw')
    ensureDir(dir)
    const hash = Buffer.from(buf.slice(0, 16)).toString('hex')
    const filepath = join(dir, `${hash}.bin`)
    writeFileSync(filepath, buf)
  } catch {}
}
