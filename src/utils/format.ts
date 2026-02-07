function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function getDateKey(d = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function getDateTime(d = new Date()): string {
  return `${getDateKey(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}
