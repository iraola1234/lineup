import { corta, duracion, fmtHoras, toHours } from '../../lib/time'
import type { Area, Asignacion, Empleado, TipoTurno } from '../../lib/types'

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

export const rango = (a: Pick<Asignacion, 'inicio_plan' | 'fin_plan'>) => `${corta(a.inicio_plan)}–${corta(a.fin_plan)}`

/** Etiquetas de hora del eje: "05", "06", … "02". */
export const HORAS_EJE = Array.from({ length: EJE_HORAS }, (_, i) => String((EJE_DESDE + i) % 24).padStart(2, '0'))

/** Horas planificadas contra contrato, con barrita de progreso. Solo avisa, nunca bloquea. */
export function HorasContrato({ horas, contrato, compacto = false }: { horas: number; contrato: number; compacto?: boolean }) {
  const pasado = horas > contrato
  const completo = contrato > 0 && horas === contrato
  const pct = contrato > 0 ? Math.min(100, (horas / contrato) * 100) : 0
  const color = pasado ? '#A33A2C' : completo ? '#55624A' : '#8A9B6A'
  const h = fmtHoras(horas).replace('\u202Fh', '')
  return (
    <span className={`inline-flex items-center gap-2 ${compacto ? '' : 'w-full'}`} title={pasado ? 'Supera las horas de contrato' : undefined}>
      <span
        className={`font-mono text-[11px] whitespace-nowrap ${pasado ? 'font-semibold text-danger' : 'text-muted'}`}
        aria-label={`${h} de ${contrato} horas de contrato`}
      >
        {h}/{contrato}{'\u202F'}h
      </span>
      <span aria-hidden="true" className={`h-1 overflow-hidden rounded-full bg-divider ${compacto ? 'w-10' : 'min-w-8 flex-1'}`}>
        <span className="block h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: color }} />
      </span>
    </span>
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

export type Grupo = { area: Area; empleados: Empleado[] }

/** Empleados agrupados por área, en el orden configurado. */
export function porArea(areas: Area[], empleados: Empleado[]): Grupo[] {
  return areas
    .map((area) => ({ area, empleados: empleados.filter((e) => e.area_id === area.id) }))
    .filter((g) => g.empleados.length > 0)
}

export type VistaProps = {
  grupos: Grupo[]
  tipos: TipoTurno[]
  turnosDe: (empleadoId: string, fecha: string) => Asignacion[]
  horasSemana: Map<string, number>
  fecha: string
  onAbrir: (emp: Empleado, fecha: string) => void
}

export const horasTotales = (turnos: Asignacion[]) => turnos.reduce((s, a) => s + (a.ausente ? 0 : Number(a.horas_plan)), 0)
