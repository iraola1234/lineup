import { BarChart3, Wallet } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { Placeholder } from '../components/Placeholder'

export function PropinasPage() {
  return (
    <>
      <PageHeader title="Propinas" subtitle="Reparto semanal" />
      <Placeholder
        icon={<Wallet size={22} />}
        titulo="Repartí las propinas sin calculadora"
        descripcion="Cargás lo que se juntó cada día y la app lo divide entre quienes trabajaron, según sus horas reales."
        items={['Monto por día, de lunes a domingo', 'Reparto por hora trabajada, día por día', 'Total a pagar por persona en la semana']}
      />
    </>
  )
}

export function MesPage() {
  return (
    <>
      <PageHeader title="Resumen del mes" subtitle="Horas y propinas" />
      <Placeholder
        icon={<BarChart3 size={22} />}
        titulo="Todo el mes, por persona"
        descripcion="Para corroborar a fin de mes cuántas horas hizo cada uno y cuánto le tocó de propina."
        items={['Horas planificadas contra reales', 'Propinas acumuladas', 'Exportar a Excel']}
      />
    </>
  )
}
