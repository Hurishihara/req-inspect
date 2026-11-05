import type { IncomingMessage, ServerResponse } from 'node:http'

import { toSummary } from '../domain/summary.js'
import type { RingStore } from '../store/ring-store.js'

export const stream = (
  res: ServerResponse,
  req: IncomingMessage,
  store: RingStore,
  keepAliveMs: number,
): void => {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-store, no-transform',
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
