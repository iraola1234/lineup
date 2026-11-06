import { Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Props = {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  /** Acceso a Configuración en el encabezado (solo celular; en PC está en el menú lateral). */
  showSettings?: boolean
}

export function PageHeader({ title, subtitle, actions, children, showSettings = true }: Props) {
  return (
    <header className="border-b border-line bg-card lg:border-none lg:bg-transparent">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3.5 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-3.5 lg:gap-4 lg:px-8 lg:pt-7 lg:pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="m-0 truncate text-[22px] font-semibold tracking-[-0.02em] lg:text-[26px]">{title}</h1>
            {subtitle && <div className="truncate text-[13px] text-muted lg:text-sm">{subtitle}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-1.5 lg:gap-2">
            {actions}
            {showSettings && (
              <Link
                to="/configuracion"
                aria-label="Configuración"
                title="Configuración"
                className="flex size-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-hover hover:text-ink active:bg-press lg:hidden"
              >
                <Settings size={20} />
              </Link>
            )}
          </div>
        </div>
        {children}
      </div>
    </header>
  )
}

/** Contenedor estándar del cuerpo de una página. */
export function PageBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 pt-4 pb-10 lg:px-8 lg:pt-4 ${className}`}>{children}</div>
  )
}
