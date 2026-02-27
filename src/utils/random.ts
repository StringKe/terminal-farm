/** 简单 sleep */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** 在 [min, max] 范围内生成随机整数 */
export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** 带抖动的 sleep：baseMs ± baseMs * jitterRatio */
export function jitteredSleep(baseMs: number, jitterRatio: number): Promise<void> {
  if (jitterRatio <= 0) return new Promise((r) => setTimeout(r, baseMs))
  const jitter = baseMs * jitterRatio
  const actual = baseMs + (Math.random() * 2 - 1) * jitter
  return new Promise((r) => setTimeout(r, Math.max(0, Math.round(actual))))
}

/** Fisher-Yates 洗牌，返回新数组 */
export function shuffleArray<T>(arr: readonly T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
