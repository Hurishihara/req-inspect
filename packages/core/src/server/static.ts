import { readFile } from 'node:fs/promises'
import type { ServerResponse } from 'node:http'
import { extname, resolve, sep } from 'node:path'

import { notFound } from './respond.js'

const CONTENT_TYPES: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
}

export const decode = (s: string): string | null => {
  try {
    const d = decodeURIComponent(s)
    return d.includes('\0') ? null : d
  } catch {
    return null
  }
}

const sendFile = async (res: ServerResponse, file: string): Promise<void> => {
  let data: Buffer
  try {
    data = await readFile(file)
  } catch {
    notFound(res)
    return
  }
  res.writeHead(200, {
    'content-type': CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': data.length,
    'x-content-type-options': 'nosniff',
  })
  res.end(data)
}

export const serveIndex = async (res: ServerResponse, uiDir: string): Promise<void> => {
  let data: Buffer
  try {
    data = await readFile(resolve(uiDir, 'index.html'))
  } catch {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(`req-inspect: dashboard files missing from package (expected at ${uiDir})`)
    return
  }
  res.writeHead(200, {
    'content-type': CONTENT_TYPES['.html'],
    'content-length': data.length,
    'x-content-type-options': 'nosniff',
  })
  res.end(data)
}

export const serveAsset = async (res: ServerResponse, uiDir: string, rawRest: string): Promise<void> => {
  const rel = decode(rawRest)
  if (rel === null || rel === '') {
    notFound(res)
    return
  }
  const assetsDir = resolve(uiDir, 'assets')
  const target = resolve(uiDir, 'assets', rel)
  if (!target.startsWith(assetsDir + sep)) {
    notFound(res)
    return
  }
  return sendFile(res, target)
}
