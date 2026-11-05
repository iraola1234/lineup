import { NavLink, Outlet } from 'react-router-dom'
import { IconCalendar, IconCash, IconCheck, IconTrend } from './icons'

const tabs = [
  { to: '/', label: 'Semana', Icon: IconCalendar, end: true },
  { to: '/cierre', label: 'Cierre', Icon: IconCheck, end: false },
  { to: '/propinas', label: 'Propinas', Icon: IconCash, end: false },
  { to: '/mes', label: 'Mes', Icon: IconTrend, end: false },
]

export function Layout() {
  return (
    <div className="mx-auto flex h-full max-w-xl flex-col bg-ground">
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <nav
        aria-label="Secciones"
        className="grid grid-cols-4 border-t border-line bg-card px-2 pb-[max(14px,env(safe-area-inset-bottom))]"
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
  )
}
