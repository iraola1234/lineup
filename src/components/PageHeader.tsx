import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { IconSettings } from './icons'

type Props = {
  title: string
  subtitle?: string
  action?: ReactNode
  children?: ReactNode
  showSettings?: boolean
}

export function PageHeader({ title, subtitle, action, children, showSettings = true }: Props) {
  return (
    <header className="flex flex-col gap-3.5 border-b border-line bg-card px-4 pt-[max(18px,env(safe-area-inset-top))] pb-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <span className="text-sm text-muted">{subtitle}</span>}
        </div>
        <div className="flex items-center gap-2">
          {action}
          {showSettings && (
            <Link
              to="/configuracion"
              aria-label="Configuración"
              className="flex size-11 items-center justify-center rounded-xl border border-line bg-card text-ink"
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
