#!/usr/bin/env bun
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { $ } from 'bun'

const ROOT = join(import.meta.dir, '..')
const DIST = join(ROOT, 'dist')
const ENTRY = join(ROOT, 'src', 'main.ts')

const targets = [
  { target: 'bun-linux-x64', output: 'terminal-farm-linux-x64' },
  { target: 'bun-linux-arm64', output: 'terminal-farm-linux-arm64' },
  { target: 'bun-darwin-x64', output: 'terminal-farm-darwin-x64' },
  { target: 'bun-darwin-arm64', output: 'terminal-farm-darwin-arm64' },
  { target: 'bun-windows-x64', output: 'terminal-farm-windows-x64.exe' },
] as const

// 支持 --target 参数只构建单个目标
const targetArg = process.argv.find((a) => a.startsWith('--target='))?.split('=')[1]
const selectedTargets = targetArg ? targets.filter((t) => t.target === targetArg) : targets

if (targetArg && selectedTargets.length === 0) {
  console.error(`未知目标: ${targetArg}`)
  console.error(`可用目标: ${targets.map((t) => t.target).join(', ')}`)
  process.exit(1)
}

mkdirSync(DIST, { recursive: true })

console.log(`构建 ${selectedTargets.length} 个目标...\n`)

for (const { target, output } of selectedTargets) {
  const outPath = join(DIST, output)
  console.log(`[${target}] → ${output}`)
  try {
    await $`bun build --compile --target=${target} ${ENTRY} --outfile ${outPath}`
      .env({ ...process.env, NODE_PATH: join(ROOT, 'stubs') })
      .quiet()
    console.log('  ✓ 完成')
  } catch (e: any) {
    console.error(`  ✗ 失败: ${e.stderr?.toString() || e.message}`)
    process.exit(1)
  }
}

console.log('\n构建完成！')
