import type { CapturedBody } from './types.js'

const OCTET = 'application/octet-stream'

const baseType = (ct: string | undefined): string => {
  return (ct ?? '').split(';')[0].trim().toLowerCase()
}

export const classifyContentType = (ct: string | undefined): 'json' | 'text' | 'binary' => {
  const t = baseType(ct)
  if (t === 'application/json' || t.endsWith('+json')) return 'json'
  if (
    t.startsWith('text/') ||
    t === 'application/x-www-form-urlencoded' ||
    t === 'application/xml' ||
    t.endsWith('+xml')
  )
    return 'text'
  return 'binary'
}

const truncateText = (buf: Buffer, maxBytes: number): { value: string; truncated: boolean } => {
  const truncated = buf.length > maxBytes
  return { value: (truncated ? buf.subarray(0, maxBytes) : buf).toString('utf8'), truncated }
}

export const captureParsedBody = (
  value: unknown,
  contentType: string | undefined,
  maxBytes: number,
): CapturedBody => {
  if (value === undefined) return { kind: 'none' }
  if (Buffer.isBuffer(value)) {
    return { kind: 'binary', contentType: baseType(contentType) || OCTET, size: value.length }
  }
  if (typeof value === 'string') {
    const buf = Buffer.from(value, 'utf8')
    return { kind: 'text', ...truncateText(buf, maxBytes), size: buf.length }
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    !contentType &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  ) {
    return { kind: 'none' }
  }
  // JSON.stringify returns undefined at runtime for undefined, functions and symbols, despite its string type.
  const stringify = (v: unknown): string | undefined => JSON.stringify(v)
  let json: string | undefined
  try {
    json = stringify(value)
  } catch {
    return { kind: 'text', value: '[unserializable]', truncated: false, size: 0 }
  }
  if (json === undefined) return { kind: 'text', value: '[unserializable]', truncated: false, size: 0 }
  const buf = Buffer.from(json, 'utf8')
  if (buf.length <= maxBytes) return { kind: 'json', value, truncated: false, size: buf.length }
  return { kind: 'text', ...truncateText(buf, maxBytes), size: buf.length }
}

export const captureRawBody = (
  chunks: Buffer[],
  totalSize: number,
  contentType: string | undefined,
  contentEncoding: string | undefined,
  maxBytes: number,
): CapturedBody => {
  if (totalSize === 0) return { kind: 'none' }
  if (contentEncoding) {
    return {
      kind: 'binary',
      contentType: baseType(contentType) || OCTET,
      size: totalSize,
      encoding: contentEncoding,
    }
  }
  const kind = classifyContentType(contentType)
  if (kind === 'binary')
    return { kind: 'binary', contentType: baseType(contentType) || OCTET, size: totalSize }
  const { value, truncated } = truncateText(Buffer.concat(chunks), maxBytes)
  const isTruncated = totalSize > maxBytes
  if (kind === 'json' && !isTruncated) {
    try {
      return { kind: 'json', value: JSON.parse(value), truncated: false, size: totalSize }
    } catch {
      /* fall through to text */
    }
  }
  return { kind: 'text', value, truncated: isTruncated || truncated, size: totalSize }
}
