import { EventEmitter } from 'node:events'

import { describe, expect, spyOn, test } from 'bun:test'
import { MongoClient } from 'mongodb'

import { instrumentMongo, type MongoClientLike } from '../src/index.js'
import { createPending } from '../src/pending.js'
import { inRequest } from './helpers.js'

let nextId = 1

const makeClient = (monitorCommands = true): EventEmitter & MongoClientLike =>
  Object.assign(new EventEmitter(), { options: { monitorCommands } }) as unknown as EventEmitter &
    MongoClientLike

type Client = ReturnType<typeof makeClient>

/** Emits started inside the current scope, then the reply later from a plain timer, as the real driver does. */
const command = async (
  client: Client,
  commandName: string,
  body: Record<string, unknown>,
  reply: { ok: true; reply: unknown } | { ok: false; message: string },
): Promise<void> => {
  const requestId = nextId++
  client.emit('commandStarted', { requestId, commandName, command: { [commandName]: 'users', ...body } })
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      if (reply.ok) client.emit('commandSucceeded', { requestId, reply: reply.reply })
      else client.emit('commandFailed', { requestId, failure: new Error(reply.message) })
      resolve()
    }, 5)
  })
}

const instrumented = (): Client => {
  const client = makeClient()
  instrumentMongo(client)
  return client
}

describe('events', () => {
  test('find records operation, target and rows from firstBatch', async () => {
    const client = instrumented()
    const events = await inRequest(async () => {
      await command(
        client,
        'find',
        { filter: { age: 3 } },
        { ok: true, reply: { cursor: { firstBatch: [1, 2, 3] } } },
      )
    })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ system: 'mongodb', operation: 'find', target: 'users', rows: 3 })
  })

  test('insert rows come from reply.n', async () => {
    const client = instrumented()
    const events = await inRequest(async () => {
      await command(
        client,
        'insert',
        { documents: [{ a: 1 }, { a: 2 }] },
        { ok: true, reply: { n: 2, ok: 1 } },
      )
    })
    expect(events[0]).toMatchObject({ operation: 'insert', rows: 2 })
  })

  test('commandFailed records the failure message', async () => {
    const client = instrumented()
    const events = await inRequest(async () => {
      await command(client, 'find', {}, { ok: false, message: 'boom' })
    })
    expect(events).toHaveLength(1)
    expect(events[0]?.error).toBe('boom')
  })

  test('hello and ping are skipped', async () => {
    const client = instrumented()
    const events = await inRequest(async () => {
      await command(client, 'hello', {}, { ok: true, reply: {} })
      await command(client, 'ping', {}, { ok: true, reply: {} })
    })
    expect(events).toHaveLength(0)
  })

  test('sensitive filter values are redacted in the statement', async () => {
    const client = instrumented()
    const events = await inRequest(async () => {
      await command(client, 'find', { filter: { password: 'x' } }, { ok: true, reply: {} })
    })
    expect(events[0]?.statement).toContain('[redacted]')
    expect(events[0]?.statement).not.toContain('"x"')
  })

  test('fingerprint ignores values', async () => {
    const client = instrumented()
    const events = await inRequest(async () => {
      await command(client, 'find', { filter: { _id: { $in: [1] } } }, { ok: true, reply: {} })
      await command(client, 'find', { filter: { _id: { $in: [4, 5, 6] } } }, { ok: true, reply: {} })
    })
    expect(events).toHaveLength(2)
    expect(events[0]?.fingerprint).toBe('find users {_id:{$in:[]}}')
    expect(events[1]?.fingerprint).toBe(events[0]?.fingerprint)
  })

  test('a command started outside any scope records nothing', async () => {
    const client = instrumented()
    await command(client, 'find', {}, { ok: true, reply: {} })
    const events = await inRequest(async () => {
      await Promise.resolve()
    })
    expect(events).toHaveLength(0)
  })

  test('instrumenting a client twice records one event per command', async () => {
    const client = makeClient()
    instrumentMongo(client)
    instrumentMongo(client)
    const events = await inRequest(async () => {
      await command(client, 'find', {}, { ok: true, reply: {} })
    })
    expect(events).toHaveLength(1)
  })
})

test('a reply that throws on access never reaches the driver', async () => {
  const client = instrumented()
  const hostile = new Proxy(
    {},
    {
      get: () => {
        throw new Error('hostile')
      },
    },
  )
  await inRequest(async () => {
    await command(client, 'find', {}, { ok: true, reply: hostile })
  })
})

test('a client without monitorCommands warns once and gets no listeners', () => {
  const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
  try {
    const a = makeClient(false)
    const b = makeClient(false)
    instrumentMongo(a)
    instrumentMongo(b)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toStartWith('req-inspect:')
    expect(a.eventNames()).toEqual([])
    expect(b.eventNames()).toEqual([])
  } finally {
    warn.mockRestore()
  }
})

test('stale pending entries are dropped on the next insert', () => {
  let now = 1000
  const spy = spyOn(performance, 'now').mockImplementation(() => now)
  try {
    const pending = createPending()
    const entry = {
      scope: { track: () => undefined, now: () => now },
      startMs: 0,
      operation: 'find',
      target: null,
      document: {},
      fingerprint: 'f',
    }
    pending.set(1, entry)
    now += 61_000
    pending.set(2, entry)
    expect(pending.size).toBe(1)
    expect(pending.take(1)).toBeUndefined()
    expect(pending.take(2)).toBe(entry)
  } finally {
    spy.mockRestore()
  }
})

test('a real MongoClient satisfies MongoClientLike', () => {
  const accepts: (c: MongoClientLike) => void = () => undefined
  accepts(new MongoClient('mongodb://127.0.0.1:1', { monitorCommands: true }))
})
