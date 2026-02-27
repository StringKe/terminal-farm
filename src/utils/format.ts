function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** 获取中国时间 (UTC+8) 的 Date 各分量 */
export function getChinaTime(d = new Date()): {
  year: number
  month: number
  day: number
  h: number
  m: number
  s: number
} {
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60_000
  const cn = new Date(utcMs + 8 * 3600_000)
  return {
    year: cn.getFullYear(),
    month: cn.getMonth() + 1,
    day: cn.getDate(),
    h: cn.getHours(),
    m: cn.getMinutes(),
    s: cn.getSeconds(),
  }
}

/** 中国时间日期 key (YYYY-MM-DD)，用于每日重置判断 */
export function getDateKey(d = new Date()): string {
  const cn = getChinaTime(d)
  return `${cn.year}-${pad2(cn.month)}-${pad2(cn.day)}`
}

/** 中国时间完整时间戳 (YYYY-MM-DD HH:mm:ss) */
export function getDateTime(d = new Date()): string {
  const cn = getChinaTime(d)
  return `${cn.year}-${pad2(cn.month)}-${pad2(cn.day)} ${pad2(cn.h)}:${pad2(cn.m)}:${pad2(cn.s)}`
}

/** 中国时间时分秒 (HH:mm:ss) */
export function getChinaTimeStr(d = new Date()): string {
  const cn = getChinaTime(d)
  return `${pad2(cn.h)}:${pad2(cn.m)}:${pad2(cn.s)}`
}

/** 本机时间时分秒 (HH:mm:ss) */
export function getLocalTimeStr(d = new Date()): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}
