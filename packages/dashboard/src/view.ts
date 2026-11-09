export type StatusClass = '2xx' | '3xx' | '4xx' | '5xx' | 'aborted' | 'none'

export const statusClass = (status: number, aborted: boolean): StatusClass => {
  if (aborted) return 'aborted'
  if (status < 200) return 'none'
  if (status >= 500) return '5xx'
  if (status >= 400) return '4xx'
  if (status >= 300) return '3xx'
  return '2xx'
}

export const isSlow = (durationMs: number): boolean => Math.round(durationMs) >= 1000

export const nextIndex = (current: number, delta: number, length: number): number => {
  if (length === 0) return -1
  if (current < 0) return 0
  return Math.min(length - 1, Math.max(0, current + delta))
}

export const listKeyIndex = (key: string, current: number, length: number): number | null => {
  if (length === 0) return null
  if (key === 'Home') return 0
  if (key === 'End') return length - 1
  if (key === 'ArrowDown') return nextIndex(current, 1, length)
  if (key === 'ArrowUp') return nextIndex(current, -1, length)
  return null
}

export const tabKeyIndex = (key: string, current: number, length: number): number | null => {
  if (key === 'ArrowRight') return (current + 1) % length
  if (key === 'ArrowLeft') return (current - 1 + length) % length
  if (key === 'Home') return 0
  if (key === 'End') return length - 1
  return null
}

export const emptyReason = (total: number, visible: number): 'waiting' | 'no-matches' | null => {
  if (visible > 0) return null
  return total === 0 ? 'waiting' : 'no-matches'
}

export const isTypingTarget = (el: { tagName: string; isContentEditable?: boolean } | null): boolean =>
  el !== null && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable === true)
