import type { NextFunction, Request, RequestHandler, Response } from 'express'
import {
  captureParsedBody,
  captureRawBody,
  createInspector,
  normalizeHeaders,
  warnOnce,
  type CapturedBody,
  type InspectorOptions,
  type RecordDraft,
} from '@req-inspect/core'

export type { InspectorOptions }

type Header = string | string[] | number | undefined

export function inspector(options: InspectorOptions = {}): RequestHandler {
  const insp = createInspector(options)
  const { enabled, maxBodyBytes: max } = insp.options

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!enabled) return next()
    const q = req.originalUrl.indexOf('?')
    const pathname = q < 0 ? req.originalUrl : req.originalUrl.slice(0, q)
    if (insp.isInspectorPath(pathname)) return insp.handle(req, res)
    if (insp.shouldIgnore(pathname)) return next()

    const startedAt = Date.now()
    const t0 = performance.now()
    const chunks: Buffer[] = []
    let kept = 0
    let total = 0
    let done = false
    // Route and params are only valid while the matched handler runs, so snapshot them on first write.
    let snap: { route: string | null; params: Record<string, string> } | undefined
    const snapshot = (): void => {
      snap ??= {
        route: req.route ? `${req.baseUrl}${req.route.path}` : null,
        params: { ...req.params },
      }
    }

    const collect = (args: unknown[]): void => {
      try {
        snapshot()
        const chunk = args[0]
        if (chunk === undefined || chunk === null || typeof chunk === 'function') return
        const enc = typeof args[1] === 'string' ? (args[1] as BufferEncoding) : 'utf8'
        const buf = typeof chunk === 'string' ? Buffer.from(chunk, enc) : Buffer.from(chunk as Uint8Array)
        total += buf.length
        if (kept < max) {
          const part = kept + buf.length > max ? buf.subarray(0, max - kept) : buf
          chunks.push(Buffer.from(part)) // copy: the caller may reuse its buffer
          kept += part.length
        }
      } catch (err) {
        warnOnce('capture', err)
      }
    }

    const origWrite = res.write as (...a: unknown[]) => boolean
    const origEnd = res.end as (...a: unknown[]) => Response
    res.write = function (this: Response, ...args: unknown[]): boolean {
      collect(args)
      return origWrite.apply(this, args)
    } as Response['write']
    res.end = function (this: Response, ...args: unknown[]): Response {
      collect(args)
      return origEnd.apply(this, args)
    } as Response['end']

    const finalize = (aborted: boolean): void => {
      if (done) return
      done = true
      try {
        snapshot()
        const reqBody = captureParsedBody(req.body, req.headers['content-type'], max)
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
          route: snap!.route,
          status: res.statusCode,
          ...(aborted ? { aborted: true as const } : {}),
          request: {
            headers: normalizeHeaders(req.headers as Record<string, Header>),
            query: req.query,
            params: snap!.params,
            body: reqBody.kind === 'binary' && reqBody.size === 0 ? { kind: 'none' } : reqBody,
          },
          response: { headers: normalizeHeaders(res.getHeaders() as Record<string, Header>), body: resBody },
        }
        insp.record(draft)
      } catch (err) {
        warnOnce('capture', err)
      }
    }

    res.once('finish', () => finalize(false))
    res.once('close', () => finalize(true))
    next()
  }
}

export default inspector
export { warnOnce }
