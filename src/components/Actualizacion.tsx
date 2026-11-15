import { RefreshCw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Cuando hay una versión nueva publicada, avisa con un cartel discreto.
 * La página no se recarga sola: se actualiza cuando la persona toca "Actualizar".
 */
export function AvisoActualizacion() {
  const [cerrado, setCerrado] = useState(false)
  const {
    needRefresh: [hayNueva],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registro) {
      // Revisa si hay versión nueva cada 30 minutos, sin recargar nada
      if (registro) setInterval(() => registro.update().catch(() => {}), 30 * 60 * 1000)
    },
  })

  useEffect(() => {
    if (hayNueva) setCerrado(false)
  }, [hayNueva])

  if (!hayNueva || cerrado) return null
  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[80] mx-auto flex max-w-[420px] animate-toast-in items-center gap-3 rounded-2xl border border-line bg-card py-2.5 pr-2 pl-4 shadow-pop lg:right-6 lg:bottom-6 lg:left-auto lg:mx-0"
    >
      <span className="flex-1 text-sm">
        <span className="font-semibold">Hay una versión nueva.</span> <span className="text-muted">Actualizá cuando quieras.</span>
      </span>
      <button
        type="button"
        onClick={() => updateServiceWorker(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-olive px-3 text-[13px] font-semibold text-white transition-colors hover:bg-olive-dark active:bg-olive-darker"
      >
        <RefreshCw size={14} aria-hidden="true" />
        Actualizar
      </button>
      <button
        type="button"
        onClick={() => setCerrado(true)}
        aria-label="Más tarde"
        className="flex size-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-hover hover:text-ink"
      >
        <X size={16} />
      </button>
    </div>
  )
}
