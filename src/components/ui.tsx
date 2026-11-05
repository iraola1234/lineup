import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'

/* ---------- Botones ---------- */

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

const btnBase =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-50'
const btnVariants: Record<BtnVariant, string> = {
  primary: 'bg-olive text-white hover:bg-olive-dark',
  secondary: 'border border-line bg-card text-ink hover:bg-head',
  danger: 'border border-danger-line bg-card text-danger hover:bg-danger-soft',
  ghost: 'text-muted hover:text-ink',
}

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return <button type="button" className={`${btnBase} ${btnVariants[variant]} ${className}`} {...props} />
}

/* ---------- Campos ---------- */

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: (id: string) => ReactNode
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-muted">
        {label}
      </label>
      {children(id)}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  )
}

export const inputCls =
  'h-12 w-full rounded-xl border border-line bg-head px-3 text-base text-ink focus:border-olive lg:h-11 lg:text-[15px]'

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />
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
    <label htmlFor={id} className="flex min-h-14 cursor-pointer items-center justify-between gap-4 py-2.5">
      <span className="flex flex-col">
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
        <span className="h-7 w-12 rounded-full bg-line transition-colors peer-checked:bg-olive peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-olive" />
        <span className="pointer-events-none absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  )
}

/* ---------- Píldoras ---------- */

export function Pill({
  children,
  bg,
  fg,
  bd,
  mono = false,
}: {
  children: ReactNode
  bg: string
  fg: string
  bd: string
  mono?: boolean
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${
        mono ? 'font-mono' : ''
      }`}
      style={{ background: bg, color: fg, borderColor: bd }}
    >
      {children}
    </span>
  )
}

export const pillNeutral = { bg: '#F3F2EE', fg: '#55544E', bd: '#E7E5DF' }
export const pillDanger = { bg: '#F9E3DF', fg: '#A33A2C', bd: '#F0C6BE' }
export const pillOk = { bg: '#E8EEDF', fg: '#475733', bd: '#CFDBBE' }

/* ---------- Panel de edición ---------- */

/**
 * Celular: hoja que sube desde abajo y ocupa casi toda la pantalla.
 * Computadora: panel lateral a la derecha.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  // onClose suele ser una función nueva en cada render: la guardamos en una ref
  // para que el efecto de abajo corra solo al abrir/cerrar, no con cada tecla.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    // Al abrir, foco en el primer campo del formulario (no en la cruz de cerrar).
    const panel = panelRef.current
    const first =
      panel?.querySelector<HTMLElement>('[data-sheet-body] input, [data-sheet-body] select, [data-sheet-body] textarea') ??
      panel?.querySelector<HTMLElement>('[data-sheet-body] button')
    first?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-stretch lg:justify-end">
      <button
        type="button"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-ink/30"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[92%] w-full flex-col rounded-t-3xl bg-card shadow-xl lg:max-h-none lg:w-[440px] lg:rounded-none lg:border-l lg:border-line"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 id={titleId} className="m-0 text-lg font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-10 items-center justify-center rounded-xl text-muted hover:bg-head hover:text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div data-sheet-body className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
          {children}
        </div>
        {footer && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 pt-4 pb-[max(16px,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- Avisos ---------- */

export function Notice({ tone = 'ok', children }: { tone?: 'ok' | 'error'; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`m-0 rounded-xl border px-3 py-2.5 text-sm ${
        tone === 'error' ? 'border-danger-line bg-danger-soft text-danger' : 'border-tarde-bd bg-tarde-bg text-tarde-fg'
      }`}
    >
      {children}
    </p>
  )
}

/* ---------- Selector segmentado ---------- */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-0.5 overflow-x-auto rounded-xl bg-divider p-[3px]">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={`h-10 shrink-0 grow rounded-[10px] px-4 text-sm font-semibold whitespace-nowrap lg:grow-0 ${
              on ? 'bg-card text-ink shadow-[0_1px_2px_rgba(28,29,26,0.12)]' : 'text-muted'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
