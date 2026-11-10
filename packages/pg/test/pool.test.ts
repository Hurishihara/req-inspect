import { AsyncResource } from 'node:async_hooks'
import { EventEmitter } from 'node:events'

import { expect, test } from 'bun:test'
import pg from 'pg'

import { instrumentPg } from '../src/index.js'
import { inRequest } from './helpers.js'

// A fake driver client whose socket callbacks run in the async context captured at connect, like a real socket.
class SocketClient extends EventEmitter {
  _queryable = true
  _ending = false
  private socket: AsyncResource | undefined
  connect(cb: () => void): void {
    this.socket = new AsyncResource('FAKESOCKET')
    setTimeout(() => {
      this.socket?.runInAsyncScope(cb)
    })
  }
  query(...args: unknown[]): void {
    const cb = args.at(-1) as (err: Error | null, res: { rowCount: number }) => void
    setTimeout(() => {
      this.socket?.runInAsyncScope(() => {
        cb(null, { rowCount: 1 })
      })
    }, 10)
  }
  end(cb?: () => void): void {
    cb?.()
  }
}

instrumentPg({ Client: SocketClient, Pool: pg.Pool })

const makePool = () => new pg.Pool({ Client: SocketClient as never, max: 1 })

test('three concurrent requests on a one-connection pool each record only their own statement', async () => {
  const pool = makePool()
  const run = (name: string) =>
    inRequest(async () => {
      await pool.query(`select '${name}'`)
      await new Promise((r) => setTimeout(r, 30))
    })
  const results = await Promise.all(['a', 'b', 'c'].map((n) => run(n)))
  for (const [i, n] of ['a', 'b', 'c'].entries()) {
    expect(results[i]?.map((e) => e.statement)).toEqual([`select '${n}'`])
  }
  await pool.end()
})

test('Promise.all of three queries on a one-connection pool all land on the request', async () => {
  const pool = makePool()
  const events = await inRequest(async () => {
    await Promise.all([pool.query('select 1'), pool.query('select 2'), pool.query('select 3')])
  })
  expect(events.map((e) => e.statement).sort()).toEqual(['select 1', 'select 2', 'select 3'])
  await pool.end()
})
