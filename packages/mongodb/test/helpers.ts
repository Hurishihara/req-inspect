import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

import { createInspector, type DbEvent } from '@req-inspect/core'

const hooks = { route: () => null, params: () => ({}), query: () => ({}), body: () => undefined }

/**
 * Runs `work` inside a real request scope (public API only) and returns the events stored on the record.
 * `work` should resolve once every query it started has settled.
 */
export const inRequest = async (work: () => Promise<void> | void): Promise<DbEvent[]> => {
  const inspector = createInspector({ enabled: true })
  const server = createServer((req, res) => {
    if (inspector.dispatch((req.url ?? '').split('?')[0] ?? '') === 'handle') {
      inspector.handle(req, res)
      return
    }
    inspector.capture(req, res, hooks, () => {
      void (async () => {
        try {
          await work()
        } finally {
          res.end('ok')
        }
      })()
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`
  try {
    await (await fetch(`${base}/work`)).text()
    await new Promise((r) => setTimeout(r, 50))
    const list = (await (await fetch(`${base}/_inspect/api/requests`)).json()) as { id: string }[]
    const id = list[0]?.id
    if (!id) return []
    const rec = (await (await fetch(`${base}/_inspect/api/requests/${id}`)).json()) as {
      db?: { events: DbEvent[] }
    }
    return rec.db?.events ?? []
  } finally {
    server.closeAllConnections()
    server.close()
  }
}
