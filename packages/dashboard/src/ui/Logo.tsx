export const Logo = ({ size, className }: { size: number; className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
    width={size}
    height={size}
    aria-hidden="true"
    focusable="false"
    className={className}
  >
    {size >= 48 ? (
      <>
        <rect className="fill-ink" x="56" y="84" width="36" height="112" rx="4" />
        <path
          className="fill-ink"
          d="M56 134C56 92 86 66 124 66A18 18 0 0 1 124 102C104 102 92 114 92 134Z"
        />
        <rect className="fill-ink" x="164" y="124" width="36" height="72" rx="4" />
        <circle className="fill-accent" cx="182" cy="84" r="22" />
      </>
    ) : (
      <>
        <path
          className="fill-ink"
          d="M40 212V140C40 94 74 60 120 60A26 26 0 0 1 120 112C102 112 88 124 88 142V212Z"
        />
        <rect className="fill-ink" x="164" y="132" width="52" height="80" rx="4" />
        <circle className="fill-accent" cx="190" cy="80" r="30" />
      </>
    )}
  </svg>
)
