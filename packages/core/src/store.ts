import type { RequestRecord } from './types.js'

const DEFAULT_LIST_LIMIT = 100
const MAX_LIST_LIMIT = 500

const numericId = (id: string): number => Number(id.slice(2))

export class RingStore {
  private readonly buf: (RequestRecord | undefined)[]
  private head = 0 // index of the next write
  private size = 0
  private counter = 0
  private readonly subs = new Set<(r: RequestRecord) => void>()

  constructor(private readonly capacity: number) {
    this.buf = new Array<RequestRecord | undefined>(Math.max(1, Math.floor(capacity)))
  }

  nextId(): string {
    this.counter += 1
    return `r_${String(this.counter).padStart(6, '0')}`
  }

  add(record: RequestRecord): void {
    this.buf[this.head] = record
    this.head = (this.head + 1) % this.buf.length
    if (this.size < this.buf.length) this.size += 1
    for (const fn of [...this.subs]) {
      try {
        fn(record)
      } catch {
        this.subs.delete(fn)
      }
    }
  }

  get(id: string): RequestRecord | undefined {
    for (let i = 0; i < this.size; i++) {
      const r = this.at(i)
      if (r?.id === id) return r
    }
    return undefined
  }

  /** Newest first. */
  list(q: { limit?: number; before?: string } = {}): RequestRecord[] {
    const limit = Math.min(MAX_LIST_LIMIT, Math.max(1, Math.floor(q.limit ?? DEFAULT_LIST_LIMIT)))
    const before = q.before === undefined ? NaN : numericId(q.before)
    const out: RequestRecord[] = []
    for (let i = this.size - 1; i >= 0 && out.length < limit; i--) {
      const r = this.at(i)
      if (!r) continue
      if (!Number.isNaN(before) && numericId(r.id) >= before) continue
      out.push(r)
    }
    return out
  }

  clear(): void {
    this.buf.fill(undefined)
    this.head = 0
    this.size = 0
  }

  subscribe(fn: (r: RequestRecord) => void): () => void {
    this.subs.add(fn)
    return () => {
      this.subs.delete(fn)
    }
  }

  /** i-th oldest record (0 = oldest). */
  private at(i: number): RequestRecord | undefined {
    const len = this.buf.length
    return this.buf[(this.head - this.size + i + len * 2) % len]
  }
}
