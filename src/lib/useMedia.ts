import { useSyncExternalStore } from 'react'

const QUERY = '(min-width: 1024px)'

/** true en pantallas de computadora (mismo corte que `lg:` de Tailwind). */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(QUERY)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}
