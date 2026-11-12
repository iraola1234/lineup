import { BarChart3, CalendarDays, CircleCheckBig, LogOut, Settings, Wallet, type LucideIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import { nombreDivision } from '../lib/divisiones'
import { useLocal } from '../lib/local'
import { Avatar, Menu } from './ui'

const secciones: { to: string; label: string; Icon: LucideIcon; end: boolean }[] = [
  { to: '/', label: 'Semana', Icon: CalendarDays, end: true },
  { to: '/cierre', label: 'Cierre', Icon: CircleCheckBig, end: false },
  { to: '/propinas', label: 'Propinas', Icon: Wallet, end: false },
  { to: '/mes', label: 'Mes', Icon: BarChart3, end: false },
]

/**
 * Celular: contenido a pantalla completa + navegación inferior.
 * Computadora (≥ 1024 px): menú lateral fijo + contenido a todo el ancho.
 */
export function Layout() {
  const { local, esAdmin, misDivisiones } = useLocal()
  const { areas } = useData()
  const { session, signOut } = useAuth()
  const email = session?.user.email ?? ''
  const rolTexto = esAdmin ? 'Administrador' : misDivisiones.length ? misDivisiones.map((d) => nombreDivision(areas, d)).join(' · ') : 'Encargado'

  return (
    <div className="flex h-full bg-ground">
      {/* Menú lateral (computadora) */}
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-line bg-[#F3F2EE] lg:flex">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <img src="/favicon.svg" alt="" className="size-7 rounded-lg" />
          <span className="text-[15px] font-semibold tracking-tight">Lineup</span>
        </div>

        <div className="mx-3 mb-2 flex items-center gap-3 rounded-xl border border-line bg-card px-3 py-2.5 shadow-xs">
          <span className="flex size-8 items-center justify-center rounded-lg bg-olive text-[13px] font-semibold text-white">
            {(local?.nombre ?? 'L').trim().charAt(0).toUpperCase()}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">{local?.nombre}</span>
            <span className="text-[11px] text-muted">Local</span>
          </span>
        </div>

        <nav aria-label="Secciones" className="flex flex-1 flex-col gap-0.5 px-3 py-2">
          <span className="px-3 pt-2 pb-1.5 text-[11px] font-medium tracking-wide text-faint uppercase">Equipo</span>
          {secciones.map((s) => (
            <SideLink key={s.to} {...s} />
          ))}
          {esAdmin && (
            <>
              <span className="px-3 pt-5 pb-1.5 text-[11px] font-medium tracking-wide text-faint uppercase">Ajustes</span>
              <SideLink to="/configuracion" end={false} label="Configuración" Icon={Settings} />
            </>
          )}
        </nav>

        <div className="border-t border-line p-3">
          <Menu
            align="start"
            items={[{ label: 'Cerrar sesión', icon: <LogOut size={16} />, onSelect: signOut }]}
            trigger={({ toggle, ref, open }) => (
              <button
                ref={ref}
                type="button"
                onClick={toggle}
                aria-expanded={open}
                className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-card ${open ? 'bg-card' : ''}`}
              >
                <Avatar nombre={email || 'Encargado'} size={32} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[13px] font-semibold">{rolTexto}</span>
                  <span className="truncate text-[11px] text-muted">{email}</span>
                </span>
              </button>
            )}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* Navegación inferior (celular) */}
        <nav
          aria-label="Secciones"
          className="grid grid-cols-4 border-t border-line bg-card/95 px-2 pb-[max(10px,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
        >
          {secciones.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `group flex h-[58px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                  isActive ? 'text-olive' : 'text-muted active:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-7 w-14 items-center justify-center rounded-full transition-colors duration-200 ${
                      isActive ? 'bg-olive-soft' : 'group-active:bg-hover'
                    }`}
                  >
                    <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                  </span>
                  <span className={isActive ? 'font-semibold' : ''}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

function SideLink({ to, end, label, Icon }: { to: string; end: boolean; label: string; Icon: LucideIcon }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors ${
          isActive ? 'bg-card font-semibold text-ink shadow-xs' : 'text-ink-2 hover:bg-card/70 hover:text-ink active:bg-card'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span aria-hidden="true" className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r bg-olive" />}
          <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} className={isActive ? 'text-olive' : 'text-muted'} />
          {label}
        </>
      )}
    </NavLink>
  )
}
