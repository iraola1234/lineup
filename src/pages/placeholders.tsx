import { PageHeader } from '../components/PageHeader'
import { Placeholder } from '../components/Placeholder'

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
