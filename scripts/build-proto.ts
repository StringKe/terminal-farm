#!/usr/bin/env bun
import { join } from 'node:path'
import { $ } from 'bun'

const ROOT = join(import.meta.dir, '..')
const PROTO_DIR = join(ROOT, 'proto')
const OUT = join(ROOT, 'src', 'protocol', 'proto-bundle.json')

const protoFiles = [
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
].map((f) => join(PROTO_DIR, f))

console.log('编译 proto 文件...')
await $`bunx pbjs -t json --keep-case -o ${OUT} ${protoFiles}`
console.log(`已生成 ${OUT}`)
