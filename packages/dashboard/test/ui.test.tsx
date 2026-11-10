import { describe, expect, test } from 'bun:test'
import { createRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { DbEvent, RequestRecord, RequestSummary } from '@req-inspect/core'

import { BodyView } from '../src/components/BodyView'
import { DetailPane, DetailView } from '../src/components/DetailPane'
import { JsonTree } from '../src/components/JsonTree'
import { QueriesPanel } from '../src/components/QueriesPanel'
import { RequestList } from '../src/components/RequestList'
import { RequestRow } from '../src/components/RequestRow'
import { initialState } from '../src/reducer'
import { Banner } from '../src/ui/Banner'
import { Button } from '../src/ui/Button'
import { CodeBlock } from '../src/ui/CodeBlock'
import { EmptyState } from '../src/ui/EmptyState'
import { KeyValueList } from '../src/ui/KeyValueList'
import { Logo } from '../src/ui/Logo'
import { LiveIndicator } from '../src/ui/LiveIndicator'
import { SearchField } from '../src/ui/SearchField'
import { StatusBadge } from '../src/ui/StatusBadge'
import { Tabs } from '../src/ui/Tabs'
import { ThemeToggle } from '../src/ui/ThemeToggle'
import { full, sum } from './helpers'

const noop = () => undefined

describe('Tabs', () => {
  test('roving tabindex and aria', () => {
    const tabs = [
      { id: 'request', label: 'Request' },
      { id: 'response', label: 'Response' },
      { id: 'curl', label: 'cURL' },
    ]
    const h = renderToStaticMarkup(<Tabs tabs={tabs} value="request" onChange={noop} idPrefix="d" />)
    expect(h).toContain('role="tablist"')
    expect(h.match(/role="tab"/g)).toHaveLength(3)
    expect(h).toContain('aria-selected="true"')
    expect(h).toContain('tabindex="0"')
    expect(h).toContain('aria-controls="d-panel-request"')
    expect(h).toContain('id="d-tab-request"')
    expect(h).toContain('border-accent')
    expect(h.match(/tabindex="-1"/g)).toHaveLength(2)
  })
})

describe('Tabs fixes', () => {
  const tabs = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ]
  test('leading is outside the tablist', () => {
    const h = renderToStaticMarkup(
      <Tabs tabs={tabs} value="a" onChange={noop} idPrefix="d" leading={<button>Back</button>} />,
    )
    expect(h).toContain('Back')
    const inner = /<div[^>]*role="tablist"[^>]*>([\s\S]*)<\/div><\/div>$/.exec(h)?.[1] ?? ''
    expect(inner).toContain('role="tab"')
    expect(inner).not.toContain('Back')
  })
  test('unknown value makes first tab focusable', () => {
    const h = renderToStaticMarkup(<Tabs tabs={tabs} value="zzz" onChange={noop} idPrefix="d" />)
    expect(h.match(/tabindex="0"/g)).toHaveLength(1)
    expect(h.indexOf('tabindex="0"')).toBeLessThan(h.indexOf('tabindex="-1"'))
  })
})

describe('SearchField', () => {
  const render = (value: string) =>
    renderToStaticMarkup(<SearchField value={value} onChange={noop} onClear={noop} inputRef={createRef()} />)
  test('empty shows kbd', () => {
    const h = render('')
    expect(h).toContain('aria-label="Filter requests"')
    expect(h).toContain('placeholder="Filter: POST /users 5xx"')
    expect(h).toMatch(/<kbd[^>]*>\/<\/kbd>/)
  })
  test('with text hides kbd', () => {
    expect(render('x')).not.toContain('<kbd')
  })
})

describe('KeyValueList', () => {
  test('redacted', () => {
    const h = renderToStaticMarkup(<KeyValueList entries={[['authorization', '[redacted]']]} />)
    expect(h).toContain('<dl')
    expect(h).toContain('italic')
    expect(h).toContain('text-syntax-null')
  })
  test('repeated keys render all values', () => {
    const h = renderToStaticMarkup(
      <KeyValueList
        entries={[
          ['set-cookie', 'a'],
          ['set-cookie', 'b'],
        ]}
      />,
    )
    expect(h).toContain('>a</dd>')
    expect(h).toContain('>b</dd>')
  })
  test('empty', () => {
    expect(renderToStaticMarkup(<KeyValueList entries={[]} />)).toContain('No headers')
  })
})

describe('CodeBlock', () => {
  test('renders', () => {
    const h = renderToStaticMarkup(<CodeBlock meta="text/plain · 214 B" text="hello" />)
    expect(h).toContain('text/plain · 214 B')
    expect(h).toContain('Copy')
    expect(h).toMatch(/<pre[^>]*>hello<\/pre>/)
  })
})

describe('StatusBadge', () => {
  test('404', () => {
    const h = renderToStaticMarkup(<StatusBadge status={404} />)
    expect(h).toContain('404')
    expect(h).toContain('text-status-4xx')
    expect(h).toContain('bg-status-4xx-bg')
  })
  test('none', () => {
    const h = renderToStaticMarkup(<StatusBadge status={0} />)
    expect(h).toContain('—')
    expect(h).toContain('bg-surface')
  })
  test('aborted', () => {
    const h = renderToStaticMarkup(<StatusBadge status={200} aborted />)
    expect(h).toContain('aborted')
    expect(h).toContain('text-status-5xx')
  })
})

describe('Banner', () => {
  test('info', () => {
    const h = renderToStaticMarkup(<Banner variant="info" title="Truncated." />)
    for (const s of ['bg-info-bg', 'border-info', '<strong', 'Truncated.', '<svg', 'aria-hidden="true"'])
      expect(h).toContain(s)
    expect(h).not.toContain('role="alert"')
  })
  test('error', () => {
    expect(renderToStaticMarkup(<Banner variant="error" title="x" />)).toContain('role="alert"')
  })
})

describe('Button', () => {
  test('primary', () => {
    const h = renderToStaticMarkup(<Button variant="primary">Go</Button>)
    expect(h).toContain('bg-accent')
    expect(h).toContain('text-accent-ink')
    expect(h).toContain('type="button"')
  })
  test('count', () => {
    const h = renderToStaticMarkup(<Button count={3}>Resume</Button>)
    expect(h).toMatch(/<span[^>]*rounded-full[^>]*>3<\/span>/)
  })
})

describe('LiveIndicator', () => {
  test('states', () => {
    const live = renderToStaticMarkup(<LiveIndicator conn="live" paused={false} pending={0} />)
    expect(live).toContain('role="status"')
    expect(live).toContain('Live')
    expect(renderToStaticMarkup(<LiveIndicator conn="reconnecting" paused={false} pending={0} />)).toContain(
      'Reconnecting…',
    )
    const paused = renderToStaticMarkup(<LiveIndicator conn="live" paused pending={4} />)
    expect(paused).toContain('Paused')
    expect(paused).toContain('<span aria-hidden="true"> · 4 waiting</span>')
    expect(renderToStaticMarkup(<LiveIndicator conn="live" paused={false} pending={4} />)).not.toContain(
      'waiting',
    )
  })
})

describe('EmptyState', () => {
  test('renders', () => {
    const h = renderToStaticMarkup(<EmptyState title="No matches" action={<button>Clear</button>} />)
    expect(h).toContain('No matches')
    expect(h).toContain('<button>Clear</button>')
  })
})

describe('Logo', () => {
  test('full cut is theme-aware', () => {
    const h = renderToStaticMarkup(<Logo size={48} />)
    expect(h).toContain('fill-accent')
    expect(h).toContain('fill-ink')
    expect(h).toContain('aria-hidden="true"')
    expect(h).toContain('width="48"')
    expect(h).not.toMatch(/fill="#/)
    expect(h).toContain('M56 134C56 92')
  })
  test('small cut below 48', () => {
    const h = renderToStaticMarkup(<Logo size={32} />)
    expect(h).toContain('M40 212V140')
    expect(h).not.toContain('M56 134C56 92')
  })
  test('EmptyState mark renders before the title', () => {
    const h = renderToStaticMarkup(<EmptyState title="Hello" mark={48} />)
    expect(h.indexOf('<svg')).toBeGreaterThanOrEqual(0)
    expect(h.indexOf('<svg')).toBeLessThan(h.indexOf('Hello'))
  })
})

describe('RequestRow and RequestList', () => {
  test('row markup', () => {
    const item = sum('r1', {
      method: 'POST',
      url: '/api/users?x=1',
      route: '/api/users',
      status: 503,
      durationMs: 1200,
    })
    const h = renderToStaticMarkup(<RequestRow item={item} selected focusable onSelect={noop} />)
    expect(h).toContain('role="option"')
    expect(h).toContain('aria-selected="true"')
    expect(h).toContain('POST')
    expect(h).toMatch(/class="[^"]*truncate[^"]*">\/api\/users\?x=1</)
    expect(h).toContain('>/api/users<')
    expect(h).toMatch(/text-status-4xx[^>]*>1\.2 s</)
    expect(h).toContain('503')
  })
  test('fast row is not flagged', () => {
    const h = renderToStaticMarkup(
      <RequestRow item={sum('r1', { durationMs: 48 })} selected={false} focusable={false} onSelect={noop} />,
    )
    expect(h).toContain('48 ms')
    expect(h).not.toContain('text-status-4xx')
  })
  test('aborted badge', () => {
    const h = renderToStaticMarkup(
      <RequestRow item={sum('r1', { aborted: true })} selected={false} focusable onSelect={noop} />,
    )
    expect(h).toContain('aborted')
  })
  test('list states', () => {
    const ref = createRef<HTMLInputElement>()
    const list = (items: RequestSummary[], filter: string) =>
      renderToStaticMarkup(
        <RequestList
          state={{ ...initialState, items, filter }}
          dispatch={noop}
          onClear={noop}
          filterRef={ref}
        />,
      )
    const waiting = list([], '')
    expect(waiting).toContain('Waiting for requests')
    expect(waiting).toContain('Try')
    expect(waiting).toContain('font-mono text-code">curl http://localhost:3000</code>')
    const none = list([sum('r1', { method: 'GET' })], 'post')
    expect(none).toContain('No matches')
    expect(none).toContain('Nothing matches &quot;post&quot;.')
    expect(none).toContain('Clear filter')
    const some = list([sum('r1')], '')
    expect(some).toContain('role="listbox"')
    expect(some).toContain('aria-label="Requests"')
  })
})

describe('BodyView, JsonTree, DetailPane', () => {
  test('truncated text body', () => {
    const h = renderToStaticMarkup(
      <BodyView body={{ kind: 'text', value: 'hi', size: 2_000_000, truncated: true }} />,
    )
    expect(h).toContain('bg-info-bg')
    expect(h).toContain('Truncated.</strong> <span>Showing the first 64 KB of 1.9 MB.')
    expect(h).toContain('text · 1.9 MB')
  })
  test('binary body', () => {
    const h = renderToStaticMarkup(<BodyView body={{ kind: 'binary', contentType: 'image/png', size: 70 }} />)
    expect(h).toContain('Binary body.')
    expect(h).toContain('image/png · 70 B')
  })
  test('no body', () => {
    expect(renderToStaticMarkup(<BodyView body={{ kind: 'none' }} />)).toContain('No body')
  })
  test('json tree', () => {
    const h = renderToStaticMarkup(<JsonTree value={{ a: 'x', n: 1, z: null, s: '[redacted]' }} />)
    for (const c of ['text-syntax-key', 'text-syntax-string', 'text-syntax-number', 'italic']) {
      expect(h).toContain(c)
    }
    expect(h).toContain('aria-expanded="true"')
    expect(h).toContain('aria-label="Collapse"')
  })
  test('detail view keeps tabs fixed and scrolls the panel', () => {
    const h = renderToStaticMarkup(
      <DetailView record={full()} tab="overview" onTabChange={noop} onBack={() => undefined} autoFocusBack />,
    )
    expect(h).toContain('flex min-h-0 min-w-0 flex-1 flex-col')
    expect(h).toContain('h-toolbar shrink-0')
    expect(h).toMatch(/role="tabpanel"[^>]*tabindex="0"[^>]*class="min-h-0 flex-1 overflow-auto p-4"/)
    expect(h).not.toContain('detail min-w-0 flex-1 overflow-auto')
  })
  test('detail view renders the tab it is given', () => {
    const h = renderToStaticMarkup(<DetailView record={full()} tab="response" onTabChange={noop} />)
    expect(h).toContain('id="detail-panel-response"')
    expect(h).not.toContain('id="detail-panel-overview"')
  })
  test('detail pane without selection', () => {
    const h = renderToStaticMarkup(<DetailPane id={null} />)
    expect(h).toContain('Select a request')
    expect(h).toContain('Use ↑↓ to move through the list.')
  })
})

describe('ThemeToggle', () => {
  test('labels the current theme and sits in the list toolbar', () => {
    const h = renderToStaticMarkup(<ThemeToggle />)
    expect(h).toContain('aria-label="Theme: System"')
    expect(h).toContain('title="Theme: System"')
    const ref = createRef<HTMLInputElement>()
    const list = renderToStaticMarkup(
      <RequestList state={initialState} dispatch={noop} onClear={noop} filterRef={ref} />,
    )
    expect(list).toContain('aria-label="Theme: System"')
  })
})

describe('database calls', () => {
  const ev = (o: Partial<DbEvent> = {}): DbEvent => ({
    system: 'postgresql',
    operation: 'SELECT',
    target: 'users',
    statement: 'SELECT * FROM users WHERE id = $1',
    offsetMs: 1,
    durationMs: 2,
    fingerprint: 'select * from users where id = ?',
    ...o,
  })
  const dbRecord = (db: NonNullable<RequestRecord['db']>) => full({ durationMs: 100, db })
  const events = Array.from({ length: 6 }, () => ev({ paramCount: 3 }))

  test('row caption and flag', () => {
    const row = (o: Partial<RequestSummary>) =>
      renderToStaticMarkup(<RequestRow item={sum('r1', o)} selected={false} focusable onSelect={noop} />)
    expect(row({ dbCount: 8, dbMs: 42 })).toContain('8 q · 42 ms')
    const flagged = row({ dbCount: 8, dbMs: 42, dbFlag: 'repeated' })
    expect(flagged).toContain('N+1')
    expect(flagged).toContain('text-status-4xx')
    expect(flagged.indexOf('N+1')).toBeLessThan(flagged.indexOf('8 q · 42 ms'))
    const slowRow = row({ dbCount: 2, dbMs: 300, dbFlag: 'slow' })
    expect(slowRow).toContain('slow')
    expect(slowRow).toContain('text-status-4xx')
    expect(slowRow).not.toContain('N+1')
    expect(slowRow.indexOf('slow<')).toBeLessThan(slowRow.indexOf('2 q · 300 ms'))
    expect(row({})).not.toContain(' q · ')
  })
  test('queries panel', () => {
    const h = renderToStaticMarkup(
      <QueriesPanel
        record={dbRecord({
          events: [...events.slice(0, 5), ev({ durationMs: 150, error: 'boom' })],
          dropped: 20,
          totalMs: 40,
          flags: { repeated: [{ fingerprint: events[0].fingerprint, count: 6, first: 99 }], slow: [5] },
        })}
      />,
    )
    expect(h).toContain('26 queries · 40 ms · 40% of request time')
    expect(h).toContain('Repeated query.')
    expect(h).toContain('ran 6 times')
    for (const c of ['#', 'Offset', 'Operation', 'Statement', 'Duration', 'Rows']) {
      expect(h).toContain(`<th scope="col" class="py-1 pr-2 font-normal">${c}</th>`)
    }
    expect(h).toMatch(/text-status-4xx"?[^>]*>150 ms/)
    expect(h).toMatch(/text-status-5xx[^>]*>boom/)
    expect(h).toContain('3 params')
    expect(h).toContain('Not all queries recorded.')
    expect(h).toContain('20 more were made after the first 6.')
  })
  test('queries panel empty', () => {
    const h = renderToStaticMarkup(<QueriesPanel record={full()} />)
    expect(h).toContain('No database calls')
    expect(h).toContain('@req-inspect/pg')
    expect(h).toContain('@req-inspect/mongodb')
  })
  test('detail tabs order and count', () => {
    const labels = (r: RequestRecord) =>
      [
        ...renderToStaticMarkup(<DetailView record={r} tab="overview" onTabChange={noop} />).matchAll(
          /role="tab"[\s\S]*?<\/button>/g,
        ),
      ].map((m) => m[0])
    const withDb = labels(dbRecord({ events, dropped: 0, totalMs: 1, flags: { repeated: [], slow: [] } }))
    expect(withDb.map((s) => /(Overview|Request|Queries|Response)/.exec(s)?.[1])).toEqual([
      'Overview',
      'Request',
      'Queries',
      'Response',
    ])
    expect(withDb[2]).toContain('>6<')
    expect(labels(full())[2]).not.toContain('ri-tab__count')
  })
})
