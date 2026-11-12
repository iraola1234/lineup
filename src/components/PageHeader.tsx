import { KeyRound, LogOut, Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAbrirCuenta } from './MiCuenta'
import { useAuth } from '../lib/auth'
import { useLocal } from '../lib/local'
import { Avatar, Menu } from './ui'

type Props = {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  /** Acceso a Configuración en el encabezado (solo celular; en PC está en el menú lateral). */
  showSettings?: boolean
}

export function PageHeader({ title, subtitle, actions, children, showSettings = true }: Props) {
  const { esAdmin } = useLocal()
  const { session, signOut } = useAuth()
  const abrirCuenta = useAbrirCuenta()
  const navigate = useNavigate()
  const itemsCuenta = [
    ...(esAdmin ? [{ label: 'Configuración', icon: <Settings size={16} />, onSelect: () => navigate('/configuracion') }] : []),
    { label: 'Mi cuenta y contraseña', icon: <KeyRound size={16} />, onSelect: abrirCuenta },
    { label: 'Cerrar sesión', icon: <LogOut size={16} />, onSelect: signOut },
  ]
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
              <span className="lg:hidden">
                <Menu
                  items={itemsCuenta}
                  trigger={({ toggle, ref, open }) => (
                    <button
                      ref={ref}
                      type="button"
                      onClick={toggle}
                      aria-expanded={open}
                      aria-label="Mi cuenta"
                      className="flex size-11 items-center justify-center rounded-xl transition-colors hover:bg-hover active:bg-press"
                    >
                      <Avatar nombre={session?.user.email || 'Usuario'} size={30} />
                    </button>
                  )}
                />
              </span>
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
