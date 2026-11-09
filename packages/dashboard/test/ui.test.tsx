import { describe, expect, test } from 'bun:test'
import { createRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { Banner } from '../src/ui/Banner'
import { Button } from '../src/ui/Button'
import { CodeBlock } from '../src/ui/CodeBlock'
import { EmptyState } from '../src/ui/EmptyState'
import { KeyValueList } from '../src/ui/KeyValueList'
import { LiveIndicator } from '../src/ui/LiveIndicator'
import { SearchField } from '../src/ui/SearchField'
import { StatusBadge } from '../src/ui/StatusBadge'
import { Tabs } from '../src/ui/Tabs'

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
    expect(renderToStaticMarkup(<LiveIndicator conn="live" paused pending={4} />)).toContain(
      'Paused · 4 waiting',
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
