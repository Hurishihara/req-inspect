import { type KeyboardEvent, type ReactNode, useRef } from 'react'

import { tabKeyIndex } from '../view'

export interface TabItem {
  id: string
  label: string
}

export const Tabs = ({
  tabs,
  value,
  onChange,
  idPrefix,
  leading,
}: {
  tabs: TabItem[]
  value: string
  onChange: (id: string) => void
  idPrefix: string
  leading?: ReactNode
}) => {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const current = tabs.findIndex((t) => t.id === value)

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const next = tabKeyIndex(e.key, current, tabs.length)
    if (next === null) return
    e.preventDefault()
    const tab = tabs[next]
    onChange(tab.id)
    refs.current[next]?.focus()
  }

  return (
    <div role="tablist" className="flex h-toolbar items-center gap-1 border-b border-border bg-surface px-2">
      {leading}
      {tabs.map((t, i) => {
        const selected = t.id === value
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${t.id}`}
            aria-controls={`${idPrefix}-panel-${t.id}`}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              onChange(t.id)
            }}
            onKeyDown={onKeyDown}
            className={`h-full border-b-2 px-3 transition-colors duration-[120ms] ${
              selected
                ? 'border-accent font-semibold text-ink'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
