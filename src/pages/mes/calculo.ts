import { addDays } from '../../lib/fechas'
import { limitesMes, type DatosMes } from '../../lib/mes'
import { repartirDia, type RepartoDia } from '../../lib/propinas'
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
  propina: number
  turnos: Asignacion[]
}

export type FilaDia = {
  fecha: string
  estado: EstadoDia
  personas: number
  plan: number
  reales: number
  reparto: RepartoDia | null
}

export type ResumenMes = {
  personas: FilaPersona[]
  dias: FilaDia[]
  /** Propina de una persona en un día: `${empleado_id}|${fecha}` → pesos. */
  partes: Map<string, number>
  totales: {
    plan: number
    reales: number
    propinaCargada: number
    propinaRepartida: number
    diasConTurnos: number
    diasCerrados: number
    /** Días ya pasados (o de hoy) con turnos y sin confirmar. */
    diasPendientes: number
  }
}

export function calcularMes(datos: DatosMes, empleados: Empleado[], areas: Area[], mes: string, hoy: string): ResumenMes {
  const { desde, hasta } = limitesMes(mes)
  const empPorId = new Map(empleados.map((e) => [e.id, e]))
  const participa = (id: string) => empPorId.get(id)?.participa_propina ?? false
  const porFecha = new Map<string, Asignacion[]>()
  for (const a of datos.asignaciones) porFecha.set(a.fecha_jornada, [...(porFecha.get(a.fecha_jornada) ?? []), a])
  const confirmados = new Set(datos.cierres.filter((c) => c.confirmado).map((c) => c.fecha))
  const montos = new Map(datos.propinas.map((p) => [p.fecha, p.monto]))

  const dias: FilaDia[] = []
  const partes = new Map<string, number>()
  for (let f = desde; f <= hasta; f = addDays(f, 1)) {
    const turnos = porFecha.get(f) ?? []
    const monto = montos.get(f) ?? 0
    const reparto = monto > 0 ? repartirDia(f, monto, turnos, participa) : null
    reparto?.partes.forEach((p, id) => partes.set(`${id}|${f}`, p))
    dias.push({
      fecha: f,
      estado: turnos.length === 0 ? 'sin' : confirmados.has(f) ? 'confirmado' : f > hoy ? 'futuro' : 'pendiente',
      personas: new Set(turnos.filter((a) => !a.ausente).map((a) => a.empleado_id)).size,
      plan: turnos.reduce((s, a) => s + Number(a.horas_plan), 0),
      reales: turnos.reduce((s, a) => s + horasReales(a), 0),
      reparto,
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
      let propina = 0
      for (const f of vino) propina += partes.get(`${emp.id}|${f}`) ?? 0
      return {
        emp,
        area: areas.find((a) => a.id === emp.area_id),
        dias: vino.size,
        ausencias: falto.size,
        plan: turnos.reduce((s, a) => s + Number(a.horas_plan), 0),
        reales: turnos.reduce((s, a) => s + horasReales(a), 0),
        propina,
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
    partes,
    totales: {
      plan: dias.reduce((s, d) => s + d.plan, 0),
      reales: dias.reduce((s, d) => s + d.reales, 0),
      propinaCargada: datos.propinas.reduce((s, p) => s + p.monto, 0),
      propinaRepartida: [...partes.values()].reduce((s, p) => s + p, 0),
      diasConTurnos: conTurnos.length,
      diasCerrados: conTurnos.filter((d) => d.estado === 'confirmado').length,
      diasPendientes: conTurnos.filter((d) => d.estado === 'pendiente').length,
    },
  }
}
