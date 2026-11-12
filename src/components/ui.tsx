import { Check, ChevronDown, Loader2, X } from 'lucide-react'
import {
  forwardRef,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'

/* =============================================================
   Botones
   ============================================================= */

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-solid' | 'subtle'
type BtnSize = 'sm' | 'md' | 'lg'

const btnBase =
  'relative inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45'
const btnSizes: Record<BtnSize, string> = {
  sm: 'h-9 px-3 text-[13px]',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-[15px]',
}
const btnVariants: Record<BtnVariant, string> = {
  primary: 'bg-olive text-white shadow-xs hover:bg-olive-dark active:bg-olive-darker',
  secondary: 'border border-line bg-card text-ink shadow-xs hover:border-line-strong hover:bg-hover active:bg-press',
  ghost: 'text-ink-2 hover:bg-hover hover:text-ink active:bg-press',
  subtle: 'bg-olive-soft text-olive hover:bg-[#E3E9DA] active:bg-olive-line',
  danger: 'border border-danger-line bg-card text-danger hover:bg-danger-soft active:bg-[#F3D3CC]',
  'danger-solid': 'bg-danger text-white shadow-xs hover:bg-danger-dark',
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize; loading?: boolean; icon?: ReactNode }
>(function Button({ variant = 'secondary', size = 'md', loading = false, icon, className = '', children, disabled, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      className={`${btnBase} ${btnSizes[size]} ${btnVariants[variant]} ${className}`}
      {...props}
    >
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  )
})

/** Botón cuadrado con solo un ícono. `label` es obligatorio (lector de pantalla y tooltip). */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; variant?: 'ghost' | 'secondary'; size?: 'sm' | 'md' }
>(function IconButton({ label, variant = 'ghost', size = 'md', className = '', children, ...props }, ref) {
  const v =
    variant === 'secondary'
      ? 'border border-line bg-card text-ink shadow-xs hover:border-line-strong hover:bg-hover active:bg-press'
      : 'text-muted hover:bg-hover hover:text-ink active:bg-press'
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-xl transition-[background-color,color,transform] duration-150 active:scale-[0.94] disabled:pointer-events-none disabled:opacity-40 ${
        size === 'sm' ? 'size-9' : 'size-11'
      } ${v} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
})

/* =============================================================
   Formularios
   ============================================================= */

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string | null
  children: (id: string) => ReactNode
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children(id)}
      {error ? (
        <span className="text-xs font-medium text-danger">{error}</span>
      ) : (
        hint && <span className="text-xs text-muted">{hint}</span>
      )}
    </div>
  )
}

export const inputCls =
  'h-12 w-full rounded-xl border border-line bg-card px-3.5 text-base text-ink shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-faint hover:border-line-strong focus:border-olive focus:ring-3 focus:ring-olive/15 lg:h-11 lg:text-[15px]'

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(props, ref) {
  return <input ref={ref} {...props} className={`${inputCls} ${props.className ?? ''}`} />
})

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={`${inputCls} appearance-none pr-10 ${className}`}>
        {children}
      </select>
      <ChevronDown size={18} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted" aria-hidden="true" />
    </div>
  )
}

/** Interruptor accesible (checkbox con aspecto de switch). */
export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex min-h-14 cursor-pointer items-center justify-between gap-4 py-3">
      <span className="flex flex-col gap-0.5">
        <span className="text-[15px] font-medium text-ink">{label}</span>
        {description && <span className="text-xs text-muted">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="h-7 w-12 rounded-full bg-line-strong transition-colors duration-200 peer-checked:bg-olive peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-olive" />
        <span className="pointer-events-none absolute top-1 left-1 size-5 rounded-full bg-white shadow-xs transition-transform duration-200 peer-checked:translate-x-5" />
      </span>
    </label>
  )
}

/* =============================================================
   Píldoras, avatares, skeleton
   ============================================================= */

export function Pill({
  children,
  bg,
  fg,
  bd,
  mono = false,
  className = '',
}: {
  children: ReactNode
  bg: string
  fg: string
  bd: string
  mono?: boolean
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap ${
        mono ? 'font-mono' : ''
      } ${className}`}
      style={{ background: bg, color: fg, borderColor: bd }}
    >
      {children}
    </span>
  )
}

export const pillNeutral = { bg: '#F3F2EE', fg: '#55544E', bd: '#E6E4DD' }
export const pillDanger = { bg: '#F9E3DF', fg: '#A33A2C', bd: '#F0C6BE' }
export const pillOk = { bg: '#E8EEDF', fg: '#475733', bd: '#CFDBBE' }
export const pillWarn = { bg: '#FBEFD9', fg: '#8A5A12', bd: '#F1D9AE' }

const AVATAR_TONOS = [
  { bg: '#E8EEDF', fg: '#3F4D30' },
  { bg: '#FBEFD9', fg: '#7A4F0F' },
  { bg: '#E2EAF1', fg: '#2F4A60' },
  { bg: '#ECE6F1', fg: '#56406B' },
  { bg: '#F6E4DE', fg: '#8A3B2A' },
  { bg: '#E3EFEC', fg: '#2E5A50' },
  { bg: '#EFEDE8', fg: '#4A4943' },
]

export function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

function tono(seed: string) {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_TONOS[h % AVATAR_TONOS.length]
}

export function Avatar({ nombre, size = 36, muted = false }: { nombre: string; size?: number; muted?: boolean }) {
  const t = muted ? { bg: '#EFEDE8', fg: '#9A988F' } : tono(nombre)
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight"
      style={{ width: size, height: size, background: t.bg, color: t.fg, fontSize: Math.round(size * 0.36) }}
    >
      {iniciales(nombre)}
    </span>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton block ${className}`} />
}

/* =============================================================
   Selector segmentado
   ============================================================= */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className = '',
}: {
  value: T
  options: { value: T; label: string; icon?: ReactNode }[]
  onChange: (v: T) => void
  label: string
  className?: string
}) {
  return (
    <div role="tablist" aria-label={label} className={`flex gap-0.5 rounded-xl bg-[#ECEAE4] p-[3px] ${className}`}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={`inline-flex h-9 shrink-0 grow items-center justify-center gap-1.5 rounded-[9px] px-3.5 text-[13px] font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] duration-150 lg:grow-0 ${
              on ? 'bg-card text-ink shadow-[0_1px_3px_rgba(28,29,26,0.14)]' : 'text-muted hover:bg-white/50 hover:text-ink'
            }`}
          >
            {o.icon}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* =============================================================
   Capas: hoja / panel, diálogo, menú
   ============================================================= */

function useEscape(open: boolean, fn: () => void) {
  const ref = useRef(fn)
  useEffect(() => {
    ref.current = fn
  })
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ref.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
}

function useBodyLock(open: boolean) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])
}

/**
 * Celular: hoja que sube desde abajo (se puede arrastrar hacia abajo para cerrar).
 * Computadora: panel lateral a la derecha.
 */
export function Sheet({
  open,
  title,
  subtitle,
  leading,
  onClose,
  children,
  footer,
  autoFocus = true,
}: {
  open: boolean
  title: string
  subtitle?: ReactNode
  leading?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  autoFocus?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const [drag, setDrag] = useState(0)
  const startY = useRef<number | null>(null)
  useEscape(open, onClose)
  useBodyLock(open)

  useEffect(() => {
    if (!open || !autoFocus) return
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>('[data-sheet-body] input:not([type="hidden"]), [data-sheet-body] textarea')
    if (first && window.matchMedia('(pointer: fine)').matches) first.focus()
    else panel?.focus()
  }, [open, autoFocus])

  if (!open) return null

  const onPointerDown = (e: React.PointerEvent) => {
    if (window.matchMedia('(min-width: 1024px)').matches) return
    startY.current = e.clientY
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (startY.current === null) return
    setDrag(Math.max(0, e.clientY - startY.current))
  }
  const onPointerUp = () => {
    if (startY.current === null) return
    startY.current = null
    if (drag > 90) onClose()
    setDrag(0)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-stretch lg:justify-end">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 animate-fade-in bg-[#1C1D1A]/35 backdrop-blur-[1px]" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
        className="relative flex max-h-[90dvh] w-full animate-sheet-up flex-col rounded-t-[22px] bg-card shadow-sheet outline-none transition-transform duration-200 lg:max-h-none lg:w-[460px] lg:animate-sheet-left lg:rounded-none lg:border-l lg:border-line lg:shadow-pop"
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="touch-none lg:touch-auto"
        >
          <div aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-strong lg:hidden" />
          <div className="flex items-center gap-3 px-5 pt-3 pb-4 lg:pt-5">
            {leading}
            <div className="flex min-w-0 flex-1 flex-col">
              <h2 id={titleId} className="m-0 truncate text-[17px] font-semibold tracking-tight">
                {title}
              </h2>
              {subtitle && <div className="truncate text-[13px] text-muted">{subtitle}</div>}
            </div>
            <IconButton label="Cerrar" onClick={onClose} size="sm">
              <X size={18} />
            </IconButton>
          </div>
        </div>
        <div data-sheet-body className="flex flex-1 flex-col gap-5 overflow-y-auto overscroll-contain border-t border-divider px-5 py-5">
          {children}
        </div>
        {footer && (
          <div className="flex flex-wrap items-center gap-2 border-t border-divider px-5 pt-3.5 pb-[max(14px,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const titleId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEscape(open, onCancel)
  useBodyLock(open)
  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center sm:p-4">
      <div aria-hidden="true" onClick={onCancel} className="absolute inset-0 animate-fade-in bg-[#1C1D1A]/35" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex w-full max-w-[400px] animate-pop-in flex-col gap-5 rounded-[20px] bg-card p-5 shadow-pop sm:p-6"
      >
        <div className="flex flex-col gap-1.5">
          <h2 id={titleId} className="m-0 text-[17px] font-semibold tracking-tight">
            {title}
          </h2>
          <div className="text-sm leading-relaxed text-muted">{message}</div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant={danger ? 'danger-solid' : 'primary'} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export type MenuItem = {
  label: string
  description?: string
  icon?: ReactNode
  danger?: boolean
  onSelect: () => void
}

/** Menú desplegable (por ejemplo "Más acciones"). */
export function Menu({
  trigger,
  items,
  align = 'end',
}: {
  trigger: (p: { open: boolean; toggle: () => void; ref: React.Ref<HTMLButtonElement> }) => ReactNode
  items: MenuItem[]
  align?: 'start' | 'end'
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left?: number; right?: number }>({ top: 0 })
  useEscape(open, () => {
    setOpen(false)
    btnRef.current?.focus()
  })

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    // Si no entra abajo (ej. el menú de la cuenta al pie de la barra lateral), se abre hacia arriba
    const alto = 16 + items.length * 52
    const vertical = r.bottom + 6 + alto > window.innerHeight && r.top - 6 - alto > 0 ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }
    setPos(align === 'end' ? { ...vertical, right: window.innerWidth - r.right } : { ...vertical, left: r.left })
  }, [open, align, items.length])

  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  const onKeyDown = (e: React.KeyboardEvent) => {
    const els = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const i = els.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      els[(i + 1) % els.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      els[(i - 1 + els.length) % els.length]?.focus()
    }
  }

  return (
    <>
      {trigger({ open, toggle: () => setOpen((o) => !o), ref: btnRef })}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onKeyDown={onKeyDown}
            style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, right: pos.right }}
            className="z-[70] flex min-w-[240px] origin-top-right animate-pop-in flex-col rounded-2xl border border-line bg-card p-1.5 shadow-pop"
          >
            {items.map((it) => (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  it.onSelect()
                }}
                className={`flex items-start gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition-colors hover:bg-hover focus-visible:bg-hover active:bg-press ${
                  it.danger ? 'text-danger' : 'text-ink'
                }`}
              >
                {it.icon && <span className={`mt-0.5 ${it.danger ? '' : 'text-muted'}`}>{it.icon}</span>}
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{it.label}</span>
                  {it.description && <span className="text-xs text-muted">{it.description}</span>}
                </span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}

/* =============================================================
   Avisos y estados vacíos
   ============================================================= */

export function Notice({ tone = 'ok', children }: { tone?: 'ok' | 'error' | 'info'; children: ReactNode }) {
  const cls =
    tone === 'error'
      ? 'border-danger-line bg-danger-soft text-danger'
      : tone === 'info'
        ? 'border-line bg-head text-ink-2'
        : 'border-tarde-bd bg-tarde-bg text-tarde-fg'
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm ${cls}`}>
      {children}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-card/60 px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-olive-soft text-olive">{icon}</span>
      <div className="flex flex-col gap-1">
        <h3 className="m-0 text-[15px] font-semibold">{title}</h3>
        {description && <p className="m-0 max-w-sm text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}

/** Marca de selección para opciones elegidas. */
export function SelectedCheck() {
  return (
    <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-current">
      <Check size={11} strokeWidth={3} className="text-white mix-blend-normal" />
    </span>
  )
}
