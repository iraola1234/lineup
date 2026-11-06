import { useCallback, useEffect, useRef, useState } from 'react'
import { addDays } from './fechas'
import { supabase } from './supabase'
import { duracion } from './time'
import type { Asignacion, DiaCierre, OpcionTurno } from './types'

/** Nombre y color con que se guarda un turno "Otro" (horario a mano). */
export const OTRO = { nombre: 'Especial', color: 'especial' }

/** Un turno sin los campos que genera la base. */
export type FilaTurno = Pick<
  Asignacion,
  'empleado_id' | 'fecha_jornada' | 'tipo_turno_id' | 'nombre_turno' | 'color' | 'inicio_plan' | 'fin_plan' | 'horas_reales' | 'ausente'
>

/** "Reemplazar los turnos de este rango (y empleado, si se indica) por estas filas." */
export type Cambio = { desde: string; hasta: string; empleado: string | null; filas: FilaTurno[] }

export function aFila(a: Asignacion): FilaTurno {
  return {
    empleado_id: a.empleado_id,
    fecha_jornada: a.fecha_jornada,
    tipo_turno_id: a.tipo_turno_id,
    nombre_turno: a.nombre_turno,
    color: a.color,
    inicio_plan: a.inicio_plan,
    fin_plan: a.fin_plan,
    horas_reales: a.horas_reales,
    ausente: a.ausente,
  }
}

/** Turno nuevo (sin horas reales ni ausencia) a partir de una opción del selector. */
export function filaDesdeOpcion(empleadoId: string, fecha: string, op: Exclude<OpcionTurno, null>): FilaTurno {
  const base =
    'tipo' in op
      ? { tipo_turno_id: op.tipo.id, nombre_turno: op.tipo.nombre, color: op.tipo.color, inicio_plan: op.tipo.inicio, fin_plan: op.tipo.fin }
      : { tipo_turno_id: null, nombre_turno: OTRO.nombre, color: OTRO.color, inicio_plan: op.otro.inicio, fin_plan: op.otro.fin }
  return { empleado_id: empleadoId, fecha_jornada: fecha, horas_reales: null, ausente: false, ...base }
}

/** Para copiar: mismo turno en otra fecha (o persona), sin horas reales ni ausencia. */
export function copiarFila(a: FilaTurno | Asignacion, cambios: Partial<Pick<FilaTurno, 'empleado_id' | 'fecha_jornada'>>): FilaTurno {
  return { ...aFila(a as Asignacion), horas_reales: null, ausente: false, ...cambios }
}

const enCambio = (a: Asignacion, c: Cambio) =>
  a.fecha_jornada >= c.desde && a.fecha_jornada <= c.hasta && (c.empleado === null || a.empleado_id === c.empleado)

// Caché por semana: volver a una semana ya vista es instantáneo.
const cache = new Map<string, { asignaciones: Asignacion[]; cierres: DiaCierre[] }>()
let tmpSeq = 0

/**
 * Turnos de una semana y la forma de cambiarlos.
 * Los cambios se ven al instante en pantalla y se guardan en segundo plano,
 * en orden; si algo falla se vuelve al estado real de la base.
 */
export function useSemana(localId: string, lunes: string) {
  const domingo = addDays(lunes, 6)
  const key = `${localId}|${lunes}`
  const [asignaciones, setAsignacionesState] = useState<Asignacion[]>(() => cache.get(key)?.asignaciones ?? [])
  const [cierres, setCierres] = useState<DiaCierre[]>(() => cache.get(key)?.cierres ?? [])
  const [loading, setLoading] = useState(!cache.has(key))
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const ref = useRef(asignaciones)
  const setAsignaciones = useCallback((next: Asignacion[]) => {
    ref.current = next
    setAsignacionesState(next)
  }, [])

  const cola = useRef<Promise<unknown>>(Promise.resolve())
  const pendientes = useRef(0)

  const reload = useCallback(async () => {
    if (!supabase) return
    const [a, c] = await Promise.all([
      supabase.from('asignaciones').select('*').eq('local_id', localId).gte('fecha_jornada', lunes).lte('fecha_jornada', domingo).order('inicio_plan'),
      supabase.from('dias_cierre').select('*').eq('local_id', localId).gte('fecha', lunes).lte('fecha', domingo),
    ])
    if (pendientes.current > 0) return // hay cambios en curso: esperamos a que terminen
    if (a.error || c.error) {
      setError('No se pudieron cargar los turnos.')
    } else {
      const data = { asignaciones: a.data as Asignacion[], cierres: c.data as DiaCierre[] }
      cache.set(key, data)
      setAsignaciones(data.asignaciones)
      setCierres(data.cierres)
      setError(null)
    }
    setLoading(false)
  }, [localId, lunes, domingo, key, setAsignaciones])

  useEffect(() => {
    const c = cache.get(key)
    setAsignaciones(c?.asignaciones ?? [])
    setCierres(c?.cierres ?? [])
    setLoading(!c)
    reload()
  }, [key, reload, setAsignaciones])

  /**
   * Aplica cambios: actualiza la pantalla ya mismo y los guarda en orden.
   * Devuelve los cambios inversos para poder deshacer.
   */
  const aplicar = useCallback(
    (cambios: Cambio[]): { deshacer: Cambio[]; guardado: Promise<boolean> } => {
      let estado = ref.current
      const deshacer: Cambio[] = []
      for (const c of cambios) {
        deshacer.unshift({ ...c, filas: estado.filter((a) => enCambio(a, c)).map(aFila) })
        estado = [
          ...estado.filter((a) => !enCambio(a, c)),
          ...c.filas.map((f) => ({
            ...f,
            id: `tmp-${++tmpSeq}`,
            local_id: localId,
            horas_plan: duracion(f.inicio_plan, f.fin_plan),
          })),
        ]
      }
      setAsignaciones(estado)
      cache.set(key, { asignaciones: estado, cierres })

      pendientes.current++
      setGuardando(true)
      const guardado = (cola.current = cola.current.then(async () => {
        let ok = true
        if (supabase) {
          for (const c of cambios) {
            const { error } = await supabase.rpc('reemplazar_turnos', {
              p_local: localId,
              p_desde: c.desde,
              p_hasta: c.hasta,
              p_empleado: c.empleado,
              p_filas: c.filas,
            })
            if (error) {
              ok = false
              break
            }
          }
        }
        pendientes.current--
        if (pendientes.current === 0) {
          setGuardando(false)
          await reload() // sincroniza ids reales y cierres
        }
        return ok
      }) as Promise<boolean>)
      return { deshacer, guardado }
    },
    [localId, key, cierres, reload, setAsignaciones],
  )

  /** Lee turnos de un rango fuera de la semana cargada (para copiar). */
  const leerRango = useCallback(
    async (desde: string, hasta: string): Promise<Asignacion[] | null> => {
      if (!supabase) return null
      const { data, error } = await supabase
        .from('asignaciones')
        .select('*')
        .eq('local_id', localId)
        .gte('fecha_jornada', desde)
        .lte('fecha_jornada', hasta)
      return error ? null : (data as Asignacion[])
    },
    [localId],
  )

  return { asignaciones, cierres, loading, error, guardando, reload, aplicar, leerRango, domingo }
}
