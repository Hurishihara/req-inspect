export type Theme = 'system' | 'light' | 'dark'

export const THEME_KEY = 'req-inspect:theme'

const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }

export const nextTheme = (t: Theme): Theme => NEXT[t]

export const readTheme = (storage: Pick<Storage, 'getItem'> | null): Theme => {
  try {
    const v = storage?.getItem(THEME_KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

export const applyTheme = (
  t: Theme,
  root: HTMLElement,
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null,
): void => {
  if (t === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', t)
  try {
    if (t === 'system') storage?.removeItem(THEME_KEY)
    else storage?.setItem(THEME_KEY, t)
  } catch {
    /* storage unavailable */
  }
}
