import { areaDeCierre } from '../../lib/divisiones'
import { addDays } from '../../lib/fechas'
import { limitesMes, type DatosMes } from '../../lib/mes'
import { horasReales } from '../../lib/semana'
import type { Area, Asignacion, Empleado } from '../../lib/types'

export type EstadoDia = 'sin' | 'futuro' | 'pendiente' | 'confirmado'

export type FilaPersona = {
  emp: Empleado
  area: Area | undefined
  /** Días en que vino a trabajar. */
  dias: number
  /** Días en que tenía turno y faltó. */
  ausencias: number
  plan: number
  reales: number
  turnos: Asignacion[]
}

export type FilaDia = {
  fecha: string
  estado: EstadoDia
  personas: number
  plan: number
  reales: number
  /** Divisiones con turnos ese día y cuántas están confirmadas. */
  divisiones: number
  confirmadas: number
}

export type ResumenMes = {
  personas: FilaPersona[]
  dias: FilaDia[]
  /** ¿Está confirmada la división de este turno? */
  confirmado: (a: Asignacion) => boolean
  totales: {
    plan: number
    reales: number
    ausencias: number
    diasConTurnos: number
    diasCerrados: number
    /** Días ya pasados (o de hoy) con alguna división sin confirmar. */
    diasPendientes: number
  }
}

export function calcularMes(datos: DatosMes, empleados: Empleado[], areas: Area[], mes: string, hoy: string): ResumenMes {
  const { desde, hasta } = limitesMes(mes)
  const empPorId = new Map(empleados.map((e) => [e.id, e]))
  const porFecha = new Map<string, Asignacion[]>()
  for (const a of datos.asignaciones) porFecha.set(a.fecha_jornada, [...(porFecha.get(a.fecha_jornada) ?? []), a])
  const confirmadas = new Set(datos.cierres.filter((c) => c.confirmado).map((c) => `${c.fecha}|${c.area_id}|${c.momento}`))
  const claveDe = (a: Asignacion) => `${a.fecha_jornada}|${areaDeCierre(areas, empPorId.get(a.empleado_id)?.area_id)}|${a.momento}`
  const confirmado = (a: Asignacion) => confirmadas.has(claveDe(a))

  const dias: FilaDia[] = []
  for (let f = desde; f <= hasta; f = addDays(f, 1)) {
    const turnos = porFecha.get(f) ?? []
    const divs = new Set(turnos.map(claveDe))
    const ok = [...divs].filter((k) => confirmadas.has(k)).length
    dias.push({
      fecha: f,
      estado: turnos.length === 0 ? 'sin' : ok === divs.size ? 'confirmado' : f > hoy ? 'futuro' : 'pendiente',
      personas: new Set(turnos.filter((a) => !a.ausente).map((a) => a.empleado_id)).size,
      plan: turnos.reduce((s, a) => s + Number(a.horas_plan), 0),
      reales: turnos.reduce((s, a) => s + horasReales(a), 0),
      divisiones: divs.size,
      confirmadas: ok,
    })
  }

  const ordenArea = new Map(areas.map((a, i) => [a.id, i]))
  const personas: FilaPersona[] = [...new Set(datos.asignaciones.map((a) => a.empleado_id))]
    .map((id) => empPorId.get(id))
    .filter((e): e is Empleado => !!e)
    .map((emp) => {
      const turnos = datos.asignaciones.filter((a) => a.empleado_id === emp.id)
      const vino = new Set(turnos.filter((a) => !a.ausente).map((a) => a.fecha_jornada))
      const falto = new Set(turnos.filter((a) => a.ausente && !vino.has(a.fecha_jornada)).map((a) => a.fecha_jornada))
      return {
        emp,
        area: areas.find((a) => a.id === emp.area_id),
        dias: vino.size,
        ausencias: falto.size,
        plan: turnos.reduce((s, a) => s + Number(a.horas_plan), 0),
        reales: turnos.reduce((s, a) => s + horasReales(a), 0),
        turnos,
      }
    })
    .sort(
      (x, y) =>
        (ordenArea.get(x.emp.area_id) ?? 99) - (ordenArea.get(y.emp.area_id) ?? 99) ||
        x.emp.orden - y.emp.orden ||
        x.emp.nombre.localeCompare(y.emp.nombre),
    )

  const conTurnos = dias.filter((d) => d.estado !== 'sin')
  return {
    personas,
    dias,
    confirmado,
    totales: {
      plan: dias.reduce((s, d) => s + d.plan, 0),
      reales: dias.reduce((s, d) => s + d.reales, 0),
      ausencias: personas.reduce((s, p) => s + p.ausencias, 0),
      diasConTurnos: conTurnos.length,
      diasCerrados: conTurnos.filter((d) => d.estado === 'confirmado').length,
      diasPendientes: conTurnos.filter((d) => d.estado === 'pendiente').length,
    },
  }
}
