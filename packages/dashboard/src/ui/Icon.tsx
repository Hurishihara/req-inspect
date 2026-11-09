export type IconName = 'search' | 'pause' | 'play' | 'trash' | 'copy' | 'info' | 'warn' | 'error' | 'back'

const paths: Record<IconName, string> = {
  search: 'M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10ZM11 11l3.5 3.5',
  pause: 'M5.5 3v10M10.5 3v10',
  play: 'M5 3l8 5-8 5Z',
  trash: 'M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.5 7v4M9.5 7v4',
  copy: 'M5.5 5.5h8v8h-8ZM10.5 5.5v-3h-8v8h3',
  info: 'M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM8 7.5v4M8 5v.01',
  warn: 'M8 2l6.5 11.5h-13ZM8 6.5v3.5M8 12v.01',
  error: 'M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM5.5 5.5l5 5M10.5 5.5l-5 5',
  back: 'M10 3L5 8l5 5',
}

export const Icon = ({ name, className }: { name: IconName; className?: string }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={`shrink-0 ${className ?? ''}`.trim()}
  >
    <path d={paths[name]} />
  </svg>
)
