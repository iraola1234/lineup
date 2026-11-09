import { horasReales } from './semana'
import type { Asignacion } from './types'

export type RepartoDia = {
  fecha: string
  monto: number
  /** Horas reales de quienes participan de la propina ese día. */
  horas: number
  /** Pesos por hora trabajada ese día. */
  valorHora: number
  /** Parte de cada persona (empleado_id → pesos). */
  partes: Map<string, number>
}

/**
 * Reparto de la propina de un día: se divide por igual por hora trabajada
 * entre quienes trabajaron (y participan). El ausente no cobra.
 */
export function repartirDia(fecha: string, monto: number, turnos: Asignacion[], participa: (empleadoId: string) => boolean): RepartoDia {
  const horasPorPersona = new Map<string, number>()
  for (const a of turnos) {
    if (a.fecha_jornada !== fecha || !participa(a.empleado_id)) continue
    const h = horasReales(a)
    if (h > 0) horasPorPersona.set(a.empleado_id, (horasPorPersona.get(a.empleado_id) ?? 0) + h)
  }
  const horas = [...horasPorPersona.values()].reduce((s, h) => s + h, 0)
  const valorHora = horas > 0 ? monto / horas : 0
  const partes = new Map([...horasPorPersona].map(([id, h]) => [id, h * valorHora]))
  return { fecha, monto, horas, valorHora, partes }
}

const fmt = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 })
/** 12345.6 → "$ 12.346" */
export const fmtPesos = (n: number) => `$ ${fmt.format(Math.round(n))}`
