import { useState } from 'react'
import { PageBody, PageHeader } from '../../components/PageHeader'
import { Segmented } from '../../components/ui'
import { AreasTab } from './AreasTab'
import { EmpleadosTab } from './EmpleadosTab'
import { LocalTab } from './LocalTab'
import { TurnosTab } from './TurnosTab'

type Tab = 'empleados' | 'turnos' | 'areas' | 'local'

export function ConfiguracionPage() {
  const [tab, setTab] = useState<Tab>('empleados')

  return (
    <>
      <PageHeader title="Configuración" subtitle="Equipo, turnos y datos del local" showSettings={false}>
        <div className="lg:hidden">
          <Segmented
            label="Secciones de configuración"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'empleados', label: 'Empleados' },
              { value: 'turnos', label: 'Turnos' },
              { value: 'areas', label: 'Áreas' },
              { value: 'local', label: 'Local' },
            ]}
          />
        </div>
      </PageHeader>
      <PageBody>
        <div className="hidden self-start lg:block">
          <Segmented
            label="Secciones de configuración"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'empleados', label: 'Empleados' },
              { value: 'turnos', label: 'Tipos de turno' },
              { value: 'areas', label: 'Áreas' },
              { value: 'local', label: 'Local' },
            ]}
          />
        </div>
        {tab === 'empleados' && <EmpleadosTab />}
        {tab === 'turnos' && <TurnosTab />}
        {tab === 'areas' && <AreasTab />}
        {tab === 'local' && <LocalTab />}
      </PageBody>
    </>
  )
}
