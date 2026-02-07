import { toLong } from '../utils/long.js'
import { types } from './proto-loader.js'

let clientSeq = 1
let serverSeq = 0

export function encodeMsg(serviceName: string, methodName: string, bodyBytes: Uint8Array): Uint8Array {
  const msg = types.GateMessage.create({
    meta: {
      service_name: serviceName,
      method_name: methodName,
      message_type: 1,
      client_seq: toLong(clientSeq),
      server_seq: toLong(serverSeq),
    },
    body: bodyBytes || Buffer.alloc(0),
  })
  const encoded = types.GateMessage.encode(msg).finish()
  clientSeq++
  return encoded
}

export function getClientSeq(): number {
  return clientSeq
}

export function updateServerSeq(seq: number): void {
  if (seq > serverSeq) serverSeq = seq
}

export function resetSeq(): void {
  clientSeq = 1
  serverSeq = 0
}
