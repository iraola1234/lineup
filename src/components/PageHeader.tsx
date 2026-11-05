import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { IconSettings } from './icons'

type Props = {
  title: string
  subtitle?: string
  action?: ReactNode
  children?: ReactNode
  /** Botón de Configuración en el encabezado (solo celular; en PC está en el menú lateral). */
  showSettings?: boolean
}

export function PageHeader({ title, subtitle, action, children, showSettings = true }: Props) {
  return (
    <header className="flex flex-col gap-3.5 border-b border-line bg-card px-4 pt-[max(18px,env(safe-area-inset-top))] pb-3.5 lg:border-none lg:bg-transparent lg:px-8 lg:pt-8 lg:pb-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-2xl font-bold tracking-tight lg:text-[28px]">{title}</h1>
          {subtitle && <span className="text-sm text-muted lg:text-[15px]">{subtitle}</span>}
        </div>
        <div className="flex items-center gap-2">
          {action}
          {showSettings && (
            <Link
              to="/configuracion"
              aria-label="Configuración"
              className="flex size-11 items-center justify-center rounded-xl border border-line bg-card text-ink lg:hidden"
            >
              <IconSettings />
            </Link>
          )}
        </div>
      </div>
      {children}
    </header>
  )
}

/** Contenedor estándar del cuerpo de una página. */
export function PageBody({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4 px-4 pt-4 pb-8 lg:px-8 lg:pt-4">{children}</div>
}
