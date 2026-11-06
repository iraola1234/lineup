import { CircleAlert, CircleCheck, X } from 'lucide-react'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Toast = {
  id: number
  message: string
  tone: 'ok' | 'error'
  action?: { label: string; onClick: () => void }
}

type ToastApi = {
  show: (message: string, opts?: { tone?: 'ok' | 'error'; action?: Toast['action']; duration?: number }) => void
}

const ToastContext = createContext<ToastApi | null>(null)

/** Avisos breves abajo de la pantalla, con acción opcional (por ejemplo "Deshacer"). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const show = useCallback<ToastApi['show']>(
    (message, opts = {}) => {
      const id = ++seq.current
      // Un aviso a la vez: el nuevo reemplaza al anterior (como en las apps nativas).
      setToasts([{ id, message, tone: opts.tone ?? 'ok', action: opts.action }])
      window.setTimeout(() => dismiss(id), opts.duration ?? (opts.action ? 6000 : 3500))
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[80] flex flex-col items-center gap-2 px-3 lg:right-6 lg:bottom-6 lg:left-auto lg:items-end"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full max-w-[420px] animate-toast-in items-center gap-3 rounded-2xl bg-[#23251F] py-2.5 pr-2 pl-4 text-sm text-white shadow-pop"
            >
              {t.tone === 'error' ? (
                <CircleAlert size={18} className="text-[#F3A99C]" aria-hidden="true" />
              ) : (
                <CircleCheck size={18} className="text-[#B5C79A]" aria-hidden="true" />
              )}
              <span className="flex-1 py-1 leading-snug">{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action!.onClick()
                    dismiss(t.id)
                  }}
                  className="h-9 rounded-lg px-3 text-[13px] font-semibold text-[#C9D6A8] transition-colors hover:bg-white/10 active:bg-white/15"
                >
                  {t.action.label}
                </button>
              )}
              <button
                type="button"
                aria-label="Cerrar aviso"
                onClick={() => dismiss(t.id)}
                className="flex size-9 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider')
  return ctx
}
