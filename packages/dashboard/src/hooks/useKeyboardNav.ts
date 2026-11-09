import { type RefObject, useEffect } from 'react'

import { isTypingTarget } from '../view'

export const useKeyboardNav = ({ filterRef }: { filterRef: RefObject<HTMLInputElement | null> }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      if (isTypingTarget(document.activeElement)) return
      e.preventDefault()
      filterRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [filterRef])
}
