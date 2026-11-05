import type { NextFunction, Request, RequestHandler, Response } from 'express'
import {
  captureRawBody,
  createInspector,
  normalizeHeaders,
  warnOnce,
  type CapturedBody,
  type InspectorOptions,
  type RecordDraft,
} from '@req-inspect/core'

export type { InspectorOptions }

export const inspector = (options: InspectorOptions = {}): RequestHandler => {
  const insp = createInspector(options)
  const { enabled, maxBodyBytes: max } = insp.options

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!enabled) {
      next()
      return
    }
    const q = req.originalUrl.indexOf('?')
    const pathname = q < 0 ? req.originalUrl : req.originalUrl.slice(0, q)
    if (insp.isInspectorPath(pathname)) {
      insp.handle(req, res)
      return
    }
    if (insp.shouldIgnore(pathname)) {
      next()
      return
    }

    const startedAt = Date.now()
    const t0 = performance.now()
    const chunks: Buffer[] = []
    let kept = 0
    let total = 0
    let done = false
    // Route and params are only valid while the matched handler runs, so snapshot them on first write.
    let snap: { route: string | null; params: Record<string, string> } | undefined
    const snapshot = (): { route: string | null; params: Record<string, string> } => {
      // req.route is undefined until Express matches a route, whatever its declared type says.
      const route = req.route as { path: unknown } | undefined
      snap ??= {
        route: route ? `${req.baseUrl}${String(route.path)}` : null,
        params: { ...req.params },
      }
      return snap
    }

    const collect = (args: unknown[]): void => {
      try {
        snapshot()
        const chunk = args[0]
        if (typeof chunk !== 'string' && !(chunk instanceof Uint8Array)) return
        const enc = typeof args[1] === 'string' ? (args[1] as BufferEncoding) : 'utf8'
        if (kept >= max) {
          // Cap reached: only measure, never copy.
          total += typeof chunk === 'string' ? Buffer.byteLength(chunk, enc) : chunk.byteLength
          return
        }
        const room = max - kept
        let part: Buffer
        if (typeof chunk === 'string') {
          const buf = Buffer.from(chunk, enc) // already a private copy
          total += buf.length
          part = buf.length > room ? Buffer.from(buf.subarray(0, room)) : buf
        } else {
          const bytes = chunk
          total += bytes.byteLength
          // Copy only the kept slice: the caller may reuse its buffer.
          part = Buffer.from(bytes.subarray(0, Math.min(bytes.byteLength, room)))
        }
        chunks.push(part)
        kept += part.length
      } catch (err) {
        warnOnce('capture', err)
      }
    }

    // eslint-disable-next-line @typescript-eslint/unbound-method -- called via apply(res, args)
    const origWrite = res.write as (...a: unknown[]) => boolean
    // eslint-disable-next-line @typescript-eslint/unbound-method -- called via apply(res, args)
    const origEnd = res.end as (...a: unknown[]) => Response
    res.write = ((...args: unknown[]): boolean => {
      collect(args)
      return origWrite.apply(res, args)
    }) as Response['write']
    res.end = ((...args: unknown[]): Response => {
      collect(args)
      return origEnd.apply(res, args)
    }) as Response['end']

    const finalize = (aborted: boolean): void => {
      if (done) return
      done = true
      try {
        const captured = snapshot()
        const reqBody = insp.captureRequestBody(req.body, req.headers['content-type'])
        const resBody: CapturedBody =
          req.method === 'HEAD'
            ? { kind: 'none' }
            : captureRawBody(
                chunks,
                total,
                res.getHeader('content-type') as string | undefined,
                res.getHeader('content-encoding') as string | undefined,
                max,
              )
        const draft: RecordDraft = {
          startedAt,
          durationMs: Math.round((performance.now() - t0) * 10) / 10,
          method: req.method,
          url: req.originalUrl,
          route: captured.route,
          status: res.statusCode,
          ...(aborted ? { aborted: true as const } : {}),
          request: {
            headers: normalizeHeaders(req.headers),
            query: req.query,
            params: captured.params,
            body: reqBody.kind === 'binary' && reqBody.size === 0 ? { kind: 'none' } : reqBody,
          },
          response: { headers: normalizeHeaders(res.getHeaders()), body: resBody },
        }
        insp.record(draft)
      } catch (err) {
        warnOnce('capture', err)
      }
    }

    res.once('finish', () => {
      finalize(false)
    })
    res.once('close', () => {
      finalize(true)
    })
    next()
  }
}

export default inspector
