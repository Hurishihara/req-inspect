import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { Banner } from '../src/ui/Banner'
import { Button } from '../src/ui/Button'
import { EmptyState } from '../src/ui/EmptyState'
import { LiveIndicator } from '../src/ui/LiveIndicator'
import { StatusBadge } from '../src/ui/StatusBadge'

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
