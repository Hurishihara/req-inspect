export const formatSize = (n: number): string => {
  if (n < 1024) return `${String(n)} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export const formatDuration = (ms: number): string => {
  const r = Math.round(ms)
  return r < 1000 ? `${String(r)} ms` : `${(ms / 1000).toFixed(1)} s`
}
