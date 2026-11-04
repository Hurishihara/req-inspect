import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { checkAccess } from './guard.js'
import { toSummary } from './inspector.js'
import type { RingStore } from './store.js'
import type { ResolvedOptions } from './types.js'

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

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

const notFound = (res: ServerResponse): void => sendJson(res, 404, { error: 'not found' })

function decode(s: string): string | null {
  try {
    const d = decodeURIComponent(s)
    return d.includes('\0') ? null : d
  } catch {
    return null
  }
}

async function sendFile(res: ServerResponse, file: string): Promise<void> {
  let data: Buffer
  try {
    data = await readFile(file)
  } catch {
    return notFound(res)
  }
  res.writeHead(200, {
    'content-type': CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': data.length,
    'x-content-type-options': 'nosniff',
  })
  res.end(data)
}

async function serveIndex(res: ServerResponse, uiDir: string): Promise<void> {
  let data: Buffer
  try {
    data = await readFile(resolve(uiDir, 'index.html'))
  } catch {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(`req-inspect: dashboard files missing from package (expected at ${uiDir})`)
    return
  }
  res.writeHead(200, {
    'content-type': CONTENT_TYPES['.html']!,
    'content-length': data.length,
    'x-content-type-options': 'nosniff',
  })
  res.end(data)
}

async function serveAsset(res: ServerResponse, uiDir: string, rawRest: string): Promise<void> {
  const rel = decode(rawRest)
  if (rel === null || rel === '') return notFound(res)
  const assetsDir = resolve(uiDir, 'assets')
  const target = resolve(uiDir, 'assets', rel)
  if (!target.startsWith(assetsDir + sep)) return notFound(res)
  return sendFile(res, target)
}

function stream(res: ServerResponse, req: IncomingMessage, store: RingStore, keepAliveMs: number): void {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-store',
    connection: 'keep-alive',
  })
  res.flushHeaders()
  res.write('retry: 2000\n\n')
  const unsubscribe = store.subscribe((r) => {
    res.write(`event: record\ndata: ${JSON.stringify(toSummary(r))}\n\n`)
  })
  const timer = setInterval(() => res.write(': ping\n\n'), keepAliveMs)
  req.on('close', () => {
    clearInterval(timer)
    unsubscribe()
  })
}

export function createHandler(
  store: RingStore,
  options: ResolvedOptions,
  uiDir: string,
  keepAliveMs = 15000,
): (req: IncomingMessage, res: ServerResponse) => void {
  const mount = options.path === '/' ? '' : options.path
  const root = resolve(uiDir)

  return (req, res) => {
    const access = checkAccess({ remoteAddress: req.socket.remoteAddress, headers: req.headers }, options.auth)
    if (!access.ok) {
      if (access.status === 401) res.setHeader('WWW-Authenticate', 'Basic realm="req-inspect"')
      return sendJson(res, access.status, { error: access.status === 401 ? 'unauthorized' : 'forbidden' })
    }

    const url = (req as IncomingMessage & { originalUrl?: string }).originalUrl ?? req.url ?? '/'
    const q = url.indexOf('?')
    const pathname = q < 0 ? url : url.slice(0, q)
    const query = new URLSearchParams(q < 0 ? '' : url.slice(q + 1))

    if (mount !== '' && pathname === mount) {
      res.writeHead(302, { Location: `${mount}/` })
      return res.end()
    }
    if (!pathname.startsWith(`${mount}/`)) return notFound(res)
    const rest = pathname.slice(mount.length) // always starts with '/'
    const method = req.method ?? 'GET'

    if (method === 'GET') {
      if (rest === '/') { void serveIndex(res, root); return }
      if (rest.startsWith('/assets/')) { void serveAsset(res, root, rest.slice('/assets/'.length)); return }
      if (rest === '/api/stream') return stream(res, req, store, keepAliveMs)
      if (rest === '/api/requests') {
        const n = Number(query.get('limit'))
        const limit = query.get('limit') !== null && query.get('limit') !== '' && Number.isFinite(n) ? n : undefined
        const before = query.get('before') ?? undefined
        return sendJson(res, 200, store.list({ limit, before }).map(toSummary))
      }
      if (rest.startsWith('/api/requests/')) {
        const id = decode(rest.slice('/api/requests/'.length))
        const record = id === null ? undefined : store.get(id)
        return record ? sendJson(res, 200, record) : notFound(res)
      }
    } else if (method === 'DELETE' && rest === '/api/requests') {
      store.clear()
      res.writeHead(204, { 'cache-control': 'no-store' })
      return res.end()
    }
    return notFound(res)
  }
}
