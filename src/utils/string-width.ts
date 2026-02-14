import stringWidth from 'string-width'

/** CJK 感知的 padEnd：基于实际显示宽度填充空格 */
export function padEndCJK(str: string, targetWidth: number): string {
  const w = stringWidth(str)
  if (w >= targetWidth) return str
  return str + ' '.repeat(targetWidth - w)
}
