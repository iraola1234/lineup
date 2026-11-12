import { Clock, KeyRound, LayoutGrid, Store, Users } from 'lucide-react'
import { useState } from 'react'
import { PageBody, PageHeader } from '../../components/PageHeader'
import { Segmented, Skeleton } from '../../components/ui'
import { useData } from '../../lib/data'
import { AreasTab } from './AreasTab'
import { EmpleadosTab } from './EmpleadosTab'
import { LocalTab } from './LocalTab'
import { TurnosTab } from './TurnosTab'
import { UsuariosTab } from './UsuariosTab'

type Tab = 'empleados' | 'turnos' | 'areas' | 'usuarios' | 'local'

export function ConfiguracionPage() {
  const [tab, setTab] = useState<Tab>('empleados')
  const { loading } = useData()

  return (
    <>
      <PageHeader title="Configuración" subtitle="Equipo, turnos, usuarios y datos del local" showSettings={false}>
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <Segmented
            label="Secciones de configuración"
            value={tab}
            onChange={setTab}
            className="w-max min-w-full lg:min-w-0"
            options={[
              { value: 'empleados', label: 'Empleados', icon: <Users size={15} /> },
              { value: 'turnos', label: 'Turnos', icon: <Clock size={15} /> },
              { value: 'areas', label: 'Áreas', icon: <LayoutGrid size={15} /> },
              { value: 'usuarios', label: 'Usuarios', icon: <KeyRound size={15} /> },
              { value: 'local', label: 'Local', icon: <Store size={15} /> },
            ]}
          />
        </div>
      </PageHeader>
      <PageBody>
        {loading ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4">
                <Skeleton className="size-9 rounded-full" />
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {tab === 'empleados' && <EmpleadosTab />}
            {tab === 'turnos' && <TurnosTab />}
            {tab === 'areas' && <AreasTab />}
            {tab === 'usuarios' && <UsuariosTab />}
            {tab === 'local' && <LocalTab />}
          </>
        )}
      </PageBody>
    </>
  )
}
