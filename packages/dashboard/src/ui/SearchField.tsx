import { type RefObject, useState } from 'react'

import { Icon } from './Icon'

export const SearchField = ({
  value,
  onChange,
  onClear,
  inputRef,
}: {
  value: string
  onChange: (v: string) => void
  onClear: () => void
  inputRef: RefObject<HTMLInputElement | null>
}) => {
  const [focused, setFocused] = useState(false)
  return (
    <div className="relative flex-1">
      <Icon name="search" className="pointer-events-none absolute top-2 left-2 text-ink-muted" />
      <input
        ref={inputRef as RefObject<HTMLInputElement>}
        type="text"
        value={value}
        aria-label="Filter requests"
        placeholder="Filter: POST /users 5xx"
        onChange={(e) => {
          onChange(e.target.value)
        }}
        onFocus={() => {
          setFocused(true)
        }}
        onBlur={() => {
          setFocused(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClear()
        }}
        className="h-control w-full rounded-md border border-border-strong bg-surface-raised pr-8 pl-8 font-mono text-code text-ink placeholder:font-sans placeholder:text-ink-muted"
      />
      {value === '' && !focused && (
        <kbd className="pointer-events-none absolute top-1 right-2 rounded-sm border border-border px-1.5 font-mono text-caption text-ink-muted">
          /
        </kbd>
      )}
    </div>
  )
}
