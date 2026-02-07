import { join } from 'node:path'
import { Root, type Type } from 'protobufjs'

const PROTO_DIR = join(import.meta.dir, '..', '..', 'proto')

let root: Root | null = null

export const types: Record<string, Type> = {}

export async function loadProto(): Promise<void> {
  root = new Root()
  await root.load(
    [
      'game.proto',
      'userpb.proto',
      'plantpb.proto',
      'corepb.proto',
      'shoppb.proto',
      'friendpb.proto',
      'visitpb.proto',
      'notifypb.proto',
      'taskpb.proto',
      'itempb.proto',
    ].map((f) => join(PROTO_DIR, f)),
    { keepCase: true },
  )

  // Gate
  types.GateMessage = root.lookupType('gatepb.Message')
  types.GateMeta = root.lookupType('gatepb.Meta')
  types.EventMessage = root.lookupType('gatepb.EventMessage')

  // User
  types.LoginRequest = root.lookupType('gamepb.userpb.LoginRequest')
  types.LoginReply = root.lookupType('gamepb.userpb.LoginReply')
  types.HeartbeatRequest = root.lookupType('gamepb.userpb.HeartbeatRequest')
  types.HeartbeatReply = root.lookupType('gamepb.userpb.HeartbeatReply')
  types.ReportArkClickRequest = root.lookupType('gamepb.userpb.ReportArkClickRequest')
  types.ReportArkClickReply = root.lookupType('gamepb.userpb.ReportArkClickReply')

  // Plant
  types.AllLandsRequest = root.lookupType('gamepb.plantpb.AllLandsRequest')
  types.AllLandsReply = root.lookupType('gamepb.plantpb.AllLandsReply')
  types.HarvestRequest = root.lookupType('gamepb.plantpb.HarvestRequest')
  types.HarvestReply = root.lookupType('gamepb.plantpb.HarvestReply')
  types.WaterLandRequest = root.lookupType('gamepb.plantpb.WaterLandRequest')
  types.WaterLandReply = root.lookupType('gamepb.plantpb.WaterLandReply')
  types.WeedOutRequest = root.lookupType('gamepb.plantpb.WeedOutRequest')
  types.WeedOutReply = root.lookupType('gamepb.plantpb.WeedOutReply')
  types.InsecticideRequest = root.lookupType('gamepb.plantpb.InsecticideRequest')
  types.InsecticideReply = root.lookupType('gamepb.plantpb.InsecticideReply')
  types.RemovePlantRequest = root.lookupType('gamepb.plantpb.RemovePlantRequest')
  types.RemovePlantReply = root.lookupType('gamepb.plantpb.RemovePlantReply')
  types.PutInsectsRequest = root.lookupType('gamepb.plantpb.PutInsectsRequest')
  types.PutInsectsReply = root.lookupType('gamepb.plantpb.PutInsectsReply')
  types.PutWeedsRequest = root.lookupType('gamepb.plantpb.PutWeedsRequest')
  types.PutWeedsReply = root.lookupType('gamepb.plantpb.PutWeedsReply')
  types.FertilizeRequest = root.lookupType('gamepb.plantpb.FertilizeRequest')
  types.FertilizeReply = root.lookupType('gamepb.plantpb.FertilizeReply')

  // Item
  types.BagRequest = root.lookupType('gamepb.itempb.BagRequest')
  types.BagReply = root.lookupType('gamepb.itempb.BagReply')
  types.SellRequest = root.lookupType('gamepb.itempb.SellRequest')
  types.SellReply = root.lookupType('gamepb.itempb.SellReply')
  types.PlantRequest = root.lookupType('gamepb.plantpb.PlantRequest')
  types.PlantReply = root.lookupType('gamepb.plantpb.PlantReply')

  // Shop
  types.ShopProfilesRequest = root.lookupType('gamepb.shoppb.ShopProfilesRequest')
  types.ShopProfilesReply = root.lookupType('gamepb.shoppb.ShopProfilesReply')
  types.ShopInfoRequest = root.lookupType('gamepb.shoppb.ShopInfoRequest')
  types.ShopInfoReply = root.lookupType('gamepb.shoppb.ShopInfoReply')
  types.BuyGoodsRequest = root.lookupType('gamepb.shoppb.BuyGoodsRequest')
  types.BuyGoodsReply = root.lookupType('gamepb.shoppb.BuyGoodsReply')

  // Friend
  types.GetAllFriendsRequest = root.lookupType('gamepb.friendpb.GetAllRequest')
  types.GetAllFriendsReply = root.lookupType('gamepb.friendpb.GetAllReply')
  types.GetApplicationsRequest = root.lookupType('gamepb.friendpb.GetApplicationsRequest')
  types.GetApplicationsReply = root.lookupType('gamepb.friendpb.GetApplicationsReply')
  types.AcceptFriendsRequest = root.lookupType('gamepb.friendpb.AcceptFriendsRequest')
  types.AcceptFriendsReply = root.lookupType('gamepb.friendpb.AcceptFriendsReply')

  // Visit
  types.VisitEnterRequest = root.lookupType('gamepb.visitpb.EnterRequest')
  types.VisitEnterReply = root.lookupType('gamepb.visitpb.EnterReply')
  types.VisitLeaveRequest = root.lookupType('gamepb.visitpb.LeaveRequest')
  types.VisitLeaveReply = root.lookupType('gamepb.visitpb.LeaveReply')

  // Task
  types.TaskInfoRequest = root.lookupType('gamepb.taskpb.TaskInfoRequest')
  types.TaskInfoReply = root.lookupType('gamepb.taskpb.TaskInfoReply')
  types.ClaimTaskRewardRequest = root.lookupType('gamepb.taskpb.ClaimTaskRewardRequest')
  types.ClaimTaskRewardReply = root.lookupType('gamepb.taskpb.ClaimTaskRewardReply')
  types.BatchClaimTaskRewardRequest = root.lookupType('gamepb.taskpb.BatchClaimTaskRewardRequest')
  types.BatchClaimTaskRewardReply = root.lookupType('gamepb.taskpb.BatchClaimTaskRewardReply')

  // Notify
  types.LandsNotify = root.lookupType('gamepb.plantpb.LandsNotify')
  types.BasicNotify = root.lookupType('gamepb.userpb.BasicNotify')
  types.KickoutNotify = root.lookupType('gatepb.KickoutNotify')
  types.FriendApplicationReceivedNotify = root.lookupType('gamepb.friendpb.FriendApplicationReceivedNotify')
  types.FriendAddedNotify = root.lookupType('gamepb.friendpb.FriendAddedNotify')
  types.ItemNotify = root.lookupType('gamepb.itempb.ItemNotify')
  types.GoodsUnlockNotify = root.lookupType('gamepb.shoppb.GoodsUnlockNotify')
  types.TaskInfoNotify = root.lookupType('gamepb.taskpb.TaskInfoNotify')
}

export function getRoot(): Root | null {
  return root
}
