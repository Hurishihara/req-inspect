import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'

import type { InternalOptions } from '../domain/types.js'
import type { RingStore } from '../store/ring-store.js'
import { warnOnce } from '../support/warn.js'
import { clearRequests, getRequest, listRequests } from './api.js'
import { checkAccess } from './guard.js'
import { notFound, sendJson } from './respond.js'
import { stream } from './sse.js'
import { serveAsset, serveIndex } from './static.js'

const fail = (res: ServerResponse, err: unknown): void => {
  warnOnce('handler', err)
  try {
    if (!res.headersSent) sendJson(res, 500, { error: 'internal error' })
    else res.destroy()
  } catch {
    res.destroy()
  }
}

export const createHandler = (
  store: RingStore,
  options: InternalOptions,
  uiDir: string,
  keepAliveMs = 15000,
): ((req: IncomingMessage, res: ServerResponse) => void) => {
  const mount = options.path === '/' ? '' : options.path
  const root = resolve(uiDir)

  const dispatch = (req: IncomingMessage, res: ServerResponse): unknown => {
    if (!options.enabled) {
      notFound(res)
      return
    }
    const access = checkAccess(
      { remoteAddress: req.socket.remoteAddress, headers: req.headers },
      options.auth,
    )
    if (!access.ok) {
      if (access.status === 401) res.setHeader('WWW-Authenticate', 'Basic realm="req-inspect"')
      sendJson(res, access.status, { error: access.status === 401 ? 'unauthorized' : 'forbidden' })
      return
    }

    const url = (req as IncomingMessage & { originalUrl?: string }).originalUrl ?? req.url ?? '/'
    const q = url.indexOf('?')
    const pathname = q < 0 ? url : url.slice(0, q)
    const query = new URLSearchParams(q < 0 ? '' : url.slice(q + 1))

    if (mount !== '' && pathname === mount) {
      res.writeHead(302, { Location: `${mount}/` })
      return res.end()
    }
    if (!pathname.startsWith(`${mount}/`)) {
      notFound(res)
      return
    }
    const rest = pathname.slice(mount.length) // always starts with '/'
    const method = req.method ?? 'GET'

    if (method === 'GET') {
      if (rest === '/') {
        serveIndex(res, root).catch((e: unknown) => {
          fail(res, e)
        })
        return
      }
      if (rest.startsWith('/assets/')) {
        serveAsset(res, root, rest.slice('/assets/'.length)).catch((e: unknown) => {
          fail(res, e)
        })
        return
      }
      if (rest === '/api/stream') {
        stream(res, req, store, keepAliveMs)
        return
      }
      if (rest === '/api/requests') {
        listRequests(res, store, query)
        return
      }
      if (rest.startsWith('/api/requests/')) {
        getRequest(res, store, rest.slice('/api/requests/'.length))
        return
      }
    } else if (method === 'DELETE' && rest === '/api/requests') {
      clearRequests(res, store)
      return
    }
    notFound(res)
  }

  return (req, res) => {
    try {
      dispatch(req, res)
    } catch (err) {
      fail(res, err)
    }
  }
}
