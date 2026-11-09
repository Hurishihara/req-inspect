import type { ReactNode } from 'react'

export const SectionLabel = ({ children }: { children: ReactNode }) => (
  <h3 className="mt-6 mb-2 text-label font-semibold tracking-[0.06em] text-ink-muted uppercase first:mt-0">
    {children}
  </h3>
)
