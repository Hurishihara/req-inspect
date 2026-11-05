const seen = new Set<string>()

export const warnOnce = (key: string, err: unknown): void => {
  if (seen.has(key)) return
  seen.add(key)
  const message = err instanceof Error ? err.message : String(err)
  console.warn(`[req-inspect] ${key}: ${message}`)
}
