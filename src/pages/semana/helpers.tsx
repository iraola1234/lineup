import { Pill, pillDanger, pillNeutral, pillOk } from '../../components/ui'
import { corta, duracion, fmtHoras, toHours } from '../../lib/time'
import type { Area, Asignacion, Empleado, OpcionTurno, TipoTurno } from '../../lib/types'

/** Eje de la vista por horas: de 05:00 a 02:00 del día siguiente. */
export const EJE_DESDE = 5
export const EJE_HORAS = 21

/** Posición y ancho (en %) de la barra de un turno sobre el eje. */
export function geometria(inicio: string, fin: string) {
  const dur = duracion(inicio, fin)
  let desde = (toHours(inicio) - EJE_DESDE + 24) % 24
  let largo = dur
  if (desde > EJE_HORAS) {
    // empieza entre 02 y 05: se muestra desde el borde izquierdo
    largo = Math.max(0, dur - (24 - desde))
    desde = 0
  }
  const cortada = desde + largo > EJE_HORAS
  largo = Math.min(largo, EJE_HORAS - desde)
  return { left: (desde / EJE_HORAS) * 100, width: (largo / EJE_HORAS) * 100, cortada }
}

export const rango = (a: Asignacion) => `${corta(a.inicio_plan)}–${corta(a.fin_plan)}`

/** Etiquetas de hora del eje: "05", "06", … "02". */
export const HORAS_EJE = Array.from({ length: EJE_HORAS }, (_, i) => String((EJE_DESDE + i) % 24).padStart(2, '0'))

/** Contador de horas planificadas contra contrato. Solo avisa, nunca bloquea. */
export function ContratoPill({ horas, contrato }: { horas: number; contrato: number }) {
  const estilo = horas > contrato ? pillDanger : horas === contrato && contrato > 0 ? pillOk : pillNeutral
  const h = fmtHoras(horas).replace(' h', '')
  return (
    <Pill {...estilo} mono>
      {h}/{contrato} h
    </Pill>
  )
}

/** Abreviaturas únicas para los botones de la vista lista (M, T, N, Ma, …). */
export function abreviaturas(tipos: TipoTurno[]): Map<string, string> {
  const out = new Map<string, string>()
  const usadas = new Set(['O']) // "O" = Otro
  for (const t of tipos) {
    const limpio = t.nombre.replace(/\s+/g, '')
    let len = 1
    let ab = limpio.slice(0, len).toUpperCase()
    while (usadas.has(ab) && len < limpio.length) {
      len++
      ab = limpio.charAt(0).toUpperCase() + limpio.slice(1, len).toLowerCase()
    }
    usadas.add(ab)
    out.set(t.id, ab)
  }
  return out
}

/** Empleados agrupados por área, en el orden configurado. */
export function porArea(areas: Area[], empleados: Empleado[]) {
  return areas
    .map((area) => ({ area, empleados: empleados.filter((e) => e.area_id === area.id) }))
    .filter((g) => g.empleados.length > 0)
}

export type VistaProps = {
  areas: Area[]
  empleados: Empleado[]
  tipos: TipoTurno[]
  turnosDe: (empleadoId: string, fecha: string) => Asignacion[]
  horasSemana: Map<string, number>
  fecha: string
  onPick: (emp: Empleado, fecha: string, op: OpcionTurno) => void
  onEditar: (emp: Empleado, fecha: string) => void
}
