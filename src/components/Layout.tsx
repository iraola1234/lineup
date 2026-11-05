import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useLocal } from '../lib/local'
import { IconCalendar, IconCash, IconCheck, IconSettings, IconTrend } from './icons'

const tabs = [
  { to: '/', label: 'Semana', Icon: IconCalendar, end: true },
  { to: '/cierre', label: 'Cierre', Icon: IconCheck, end: false },
  { to: '/propinas', label: 'Propinas', Icon: IconCash, end: false },
  { to: '/mes', label: 'Mes', Icon: IconTrend, end: false },
]

/**
 * Celular: contenido a pantalla completa + navegación inferior.
 * Computadora (lg ≥ 1024 px): menú lateral fijo + contenido a todo el ancho.
 */
export function Layout() {
  const { local } = useLocal()
  const { session } = useAuth()
  const inicial = (local?.nombre ?? 'L').trim().charAt(0).toUpperCase()

  return (
    <div className="flex h-full bg-ground">
      {/* Menú lateral (solo computadora) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-head lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-line px-5">
          <span className="flex size-9 items-center justify-center rounded-xl border border-line bg-card text-sm font-semibold">
            {inicial}
          </span>
          <span className="truncate text-[15px] font-semibold">{local?.nombre}</span>
        </div>
        <nav aria-label="Secciones" className="flex flex-1 flex-col gap-1 p-3">
          <span className="px-3 pt-3 pb-1 text-xs font-medium text-muted">Equipo</span>
          {tabs.map(({ to, label, Icon, end }) => (
            <SideLink key={to} to={to} end={end} label={label} Icon={Icon} />
          ))}
          <span className="px-3 pt-5 pb-1 text-xs font-medium text-muted">Ajustes</span>
          <SideLink to="/configuracion" end={false} label="Configuración" Icon={IconSettings} />
        </nav>
        <div className="border-t border-line px-5 py-4 text-xs text-muted">
          <span className="block font-semibold text-ink">Lineup</span>
          <span className="block truncate">{session?.user.email}</span>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* Navegación inferior (solo celular) */}
        <nav
          aria-label="Secciones"
          className="grid grid-cols-4 border-t border-line bg-card px-2 pb-[max(14px,env(safe-area-inset-bottom))] lg:hidden"
        >
          {tabs.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex h-[60px] flex-col items-center gap-1 text-[11px] font-semibold ${
                  isActive ? 'text-olive' : 'text-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden="true"
                    className={`mb-1.5 h-[3px] w-7 rounded-b ${isActive ? 'bg-khaki' : 'bg-transparent'}`}
                  />
                  <Icon />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

function SideLink({
  to,
  end,
  label,
  Icon,
}: {
  to: string
  end: boolean
  label: string
  Icon: (p: object) => React.ReactElement
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] ${
          isActive ? 'bg-card font-semibold text-ink shadow-[0_1px_2px_rgba(28,29,26,0.08)]' : 'text-ink/80 hover:bg-card/60'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span aria-hidden="true" className="absolute top-2.5 bottom-2.5 -left-3 w-[3px] rounded-r bg-olive" />}
          <Icon />
          {label}
        </>
      )}
    </NavLink>
  )
}
