import type { IncomingMessage, ServerResponse } from 'node:http'

import { createDbSink, noteRequest, runInScope } from './context.js'
import { captureParsedBody, captureRawBody } from '../domain/body.js'
import { normalizeHeaders, redactBody } from '../domain/redact.js'
import type { CaptureHooks, CapturedBody, DbOptions, RecordDraft } from '../domain/types.js'
import { warnOnce } from '../support/warn.js'

interface NodeCaptureDeps {
  maxBodyBytes: number
  bodyKeys: (string | RegExp)[]
  db: Required<DbOptions>
  record: (draft: RecordDraft) => void
}

export const createNodeCapture = (deps: NodeCaptureDeps) => {
  const { maxBodyBytes: max, bodyKeys, db, record } = deps

  return (req: IncomingMessage, res: ServerResponse, hooks: CaptureHooks, next?: () => void): void => {
    const startedAt = Date.now()
    const t0 = performance.now()
    const sink = createDbSink({ db, bodyKeys, t0 })
    const chunks: Buffer[] = []
    let kept = 0
    let total = 0
    let done = false
    // Route and params are only valid while the matched handler runs, so snapshot them on first write.
    let snap: { route: string | null; params: Record<string, string> } | undefined
    const snapshot = (): { route: string | null; params: Record<string, string> } => {
      snap ??= { route: hooks.route(), params: hooks.params() }
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
          total += chunk.byteLength
          // Copy only the kept slice: the caller may reuse its buffer.
          part = Buffer.from(chunk.subarray(0, Math.min(chunk.byteLength, room)))
        }
        chunks.push(part)
        kept += part.length
      } catch (err) {
        warnOnce('capture', err)
      }
    }

    const finalize = (aborted: boolean): void => {
      if (done) return
      done = true
      try {
        const dbRecord = sink.close()
        const captured = snapshot()
        const reqBody = captureParsedBody(
          redactBody(hooks.body(), bodyKeys),
          req.headers['content-type'],
          max,
        )
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
        record({
          startedAt,
          durationMs: Math.round((performance.now() - t0) * 10) / 10,
          method: req.method ?? 'GET',
          // Frameworks that mount handlers rewrite req.url; they expose the full URL as originalUrl.
          url: (req as IncomingMessage & { originalUrl?: string }).originalUrl ?? req.url ?? '',
          route: captured.route,
          status: res.statusCode,
          ...(aborted ? { aborted: true as const } : {}),
          request: {
            headers: normalizeHeaders(req.headers),
            query: hooks.query(),
            params: captured.params,
            body: reqBody.kind === 'binary' && reqBody.size === 0 ? { kind: 'none' } : reqBody,
          },
          response: { headers: normalizeHeaders(res.getHeaders()), body: resBody },
          ...(dbRecord ? { db: dbRecord } : {}),
        })
      } catch (err) {
        warnOnce('capture', err)
      }
    }

    const install = (): void => {
      // eslint-disable-next-line @typescript-eslint/unbound-method -- called via apply(res, args)
      const origWrite = res.write as (...a: unknown[]) => boolean
      // eslint-disable-next-line @typescript-eslint/unbound-method -- called via apply(res, args)
      const origEnd = res.end as (...a: unknown[]) => ServerResponse
      try {
        res.write = ((...args: unknown[]): boolean => {
          collect(args)
          return origWrite.apply(res, args)
        }) as ServerResponse['write']
        res.end = ((...args: unknown[]): ServerResponse => {
          collect(args)
          return origEnd.apply(res, args)
        }) as ServerResponse['end']
        res.once('finish', () => {
          finalize(false)
        })
        res.once('close', () => {
          finalize(true)
        })
      } catch (err) {
        // Leave the response exactly as the framework had it.
        res.write = origWrite as ServerResponse['write']
        res.end = origEnd as ServerResponse['end']
        throw err
      }
    }

    try {
      install()
    } catch (err) {
      warnOnce('capture', err)
    }
    try {
      noteRequest()
    } catch (err) {
      warnOnce('context', err)
    }
    if (next) runInScope(sink, next)
  }
}
