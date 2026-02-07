import Long from 'long'

export function toLong(val: number | Long): Long {
  if (Long.isLong(val)) return val
  return Long.fromNumber(val as number)
}

export function toNum(val: any): number {
  if (Long.isLong(val)) return val.toNumber()
  return val || 0
}
