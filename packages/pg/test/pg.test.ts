import { EventEmitter } from 'node:events'

import { currentDbScope } from '@req-inspect/core'
import { describe, expect, test } from 'bun:test'

import { instrumentPg } from '../src/index.js'
import { inRequest } from './helpers.js'

const boom = new Error('boom')

const makeClient = () => {
  const calls: unknown[][] = []
  // bun fails a test on any real uncaughtException, so the fake driver catches what its callbacks throw.
  const escaped: unknown[] = []
  class Client {
    query(...args: unknown[]): unknown {
      calls.push(args)
      const cb = typeof args.at(-1) === 'function' ? (args.at(-1) as (...a: unknown[]) => void) : undefined
      const first = args[0]
      if (typeof first === 'object' && first !== null && 'submit' in first) return first
      const text = typeof first === 'string' ? first : (first as { text: string }).text
      if (text === 'throw') throw boom
      if (cb) {
        setImmediate(() => {
          try {
            if (text === 'fail') cb(boom)
            else cb(null, { rowCount: 3 })
          } catch (e) {
            escaped.push(e)
          }
        })
        return undefined
      }
      return text === 'fail' ? Promise.reject(boom) : Promise.resolve({ rowCount: 3 })
    }
  }
  instrumentPg({ Client })
  return { client: new Client(), calls, escaped, Client }
}

describe('promise forms', () => {
  test('(text), (text, values), (config), (config, values)', async () => {
    const { client } = makeClient()
    const events = await inRequest(async () => {
      await client.query('select * from users')
      await client.query('insert into orders (a) values ($1)', [1])
      await client.query({ text: 'update items set a = 1' })
      await client.query({ text: 'delete from carts where id = $1' }, [8])
    })
    expect(events.map((e) => [e.system, e.operation, e.target, e.rows, e.paramCount])).toEqual([
      ['postgresql', 'SELECT', 'users', 3, undefined],
      ['postgresql', 'INSERT', 'orders', 3, 1],
      ['postgresql', 'UPDATE', 'items', 3, undefined],
      ['postgresql', 'DELETE', 'carts', 3, 1],
    ])
  })

  test('returns a promise to the caller', async () => {
    const { client } = makeClient()
    let seen: unknown
    await inRequest(async () => {
      const p = client.query('select 1')
      seen = p
      await p
    })
    expect(seen).toBeInstanceOf(Promise)
  })

  test('rejection: event has error, caller sees the same error object', async () => {
    const { client } = makeClient()
    let caught: unknown
    const events = await inRequest(async () => {
      await (client.query('fail') as Promise<unknown>).catch((e: unknown) => (caught = e))
    })
    expect(caught).toBe(boom)
    expect(events).toHaveLength(1)
    expect(events[0]?.error).toBe('boom')
  })

  test('sync throw: caller sees the same object, event has error', async () => {
    const { client } = makeClient()
    let caught: unknown
    const events = await inRequest(() => {
      try {
        client.query('throw')
      } catch (e) {
        caught = e
      }
    })
    expect(caught).toBe(boom)
    expect(events).toHaveLength(1)
    expect(events[0]?.error).toBe('boom')
  })
})

describe('callback form', () => {
  test('records rows and calls the callback with the original arguments', async () => {
    const { client } = makeClient()
    let args: unknown[] = []
    const events = await inRequest(
      () =>
        new Promise<void>((resolve) => {
          client.query('select * from t', [1], (...a: unknown[]) => {
            args = a
            resolve()
          })
        }),
    )
    expect(args).toEqual([null, { rowCount: 3 }])
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ operation: 'SELECT', target: 't', rows: 3, paramCount: 1 })
  })

  test('error passed to the callback is recorded', async () => {
    const { client } = makeClient()
    const events = await inRequest(
      () =>
        new Promise<void>((resolve) => {
          client.query('fail', () => {
            resolve()
          })
        }),
    )
    expect(events).toHaveLength(1)
    expect(events[0]?.error).toBe('boom')
  })

  test('a throwing callback propagates to the driver and records once', async () => {
    const { client, escaped } = makeClient()
    const thrown = new Error('from callback')
    const events = await inRequest(
      () =>
        new Promise<void>((resolve) => {
          client.query('select 1', () => {
            resolve()
            throw thrown
          })
        }),
    )
    expect(escaped).toEqual([thrown])
    expect(escaped[0]).toBe(thrown)
    expect(events).toHaveLength(1)
  })
})

describe('submittables', () => {
  test('timed until end; same object returned', async () => {
    const { client } = makeClient()
    const sub = Object.assign(new EventEmitter(), { text: 'select * from big', submit: () => undefined })
    let returned: unknown
    const events = await inRequest(async () => {
      returned = client.query(sub)
      await new Promise((r) => setTimeout(r, 10))
      sub.emit('end', { rowCount: 5 })
    })
    expect(returned).toBe(sub)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ operation: 'SELECT', target: 'big', rows: 5 })
  })

  test('error event records error', async () => {
    const { client } = makeClient()
    const sub = Object.assign(new EventEmitter(), { text: 'select 1', submit: () => undefined })
    sub.on('error', () => undefined)
    const events = await inRequest(async () => {
      client.query(sub)
      sub.emit('error', boom)
      await Promise.resolve()
    })
    expect(events).toHaveLength(1)
    expect(events[0]?.error).toBe('boom')
  })
})

test('instrumentPg twice still records one event per query', async () => {
  const { client, Client } = makeClient()
  instrumentPg({ Client })
  const events = await inRequest(async () => {
    await client.query('select 1')
  })
  expect(events).toHaveLength(1)
})

test('outside any scope the original gets identical arguments', async () => {
  const { client, calls } = makeClient()
  expect(currentDbScope()).toBeNull()
  const values = [1]
  await client.query('select 1', values)
  expect(calls).toHaveLength(1)
  expect(calls[0]?.[0]).toBe('select 1')
  expect(calls[0]?.[1]).toBe(values)
  expect(calls[0]).toHaveLength(2)
})
