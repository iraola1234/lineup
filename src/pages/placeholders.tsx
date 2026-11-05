import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Placeholder } from '../components/Placeholder'
import { useAuth } from '../lib/auth'

export function SemanaPage() {
  return (
    <>
      <PageHeader title="Horarios" subtitle="Semana actual" />
      <Placeholder
        etapa="Etapa 2 · 16 – 22 nov"
        items={[
          'Vista por horas (05 – 02) y vista lista',
          'Asignar turnos y turno "Otro"',
          'Copiar semana, copiar día anterior, restablecer día',
          'Imagen para el grupo de WhatsApp',
        ]}
      />
    </>
  )
}

export function CierrePage() {
  return (
    <>
      <PageHeader title="Cierre del día" subtitle="Horas reales" />
      <Placeholder
        etapa="Etapa 3 · 23 – 29 nov"
        items={['Confirmar o corregir horas', 'Marcar ausencias', 'Confirmar y reabrir el día']}
      />
    </>
  )
}

export function PropinasPage() {
  return (
    <>
      <PageHeader title="Propinas" subtitle="Semana actual" />
      <Placeholder
        etapa="Etapa 3 · 23 – 29 nov"
        items={['Monto por día', 'Reparto por horas entre quienes trabajaron', 'Total semanal por persona']}
      />
    </>
  )
}

export function MesPage() {
  return (
    <>
      <PageHeader title="Resumen mensual" subtitle="Mes actual" />
      <Placeholder
        etapa="Etapa 3 · 23 – 29 nov"
        items={['Horas planificadas vs. reales', 'Propinas acumuladas', 'Exportar a Excel']}
      />
    </>
  )
}

export function ConfiguracionPage() {
  const { signOut, session } = useAuth()
  const navigate = useNavigate()
  return (
    <>
      <PageHeader title="Configuración" subtitle={session?.user.email ?? ''} showSettings={false} />
      <Placeholder
        etapa="Etapa 1 · 9 – 15 nov"
        items={['Empleados y áreas', 'Tipos de turno (crear, editar, archivar)', 'Datos del local']}
      />
      <div className="px-4">
        <button
          type="button"
          onClick={async () => {
            await signOut()
            navigate('/')
          }}
          className="h-12 w-full rounded-xl border border-line bg-card text-sm font-semibold text-ink"
        >
          Cerrar sesión
        </button>
      </div>
    </>
  )
}
