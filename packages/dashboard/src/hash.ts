export function idFromHash(hash: string): string | null {
  try {
    const id = decodeURIComponent(hash.slice(1))
    return /^r_\d+$/.test(id) ? id : null
  } catch {
    return null
  }
}
