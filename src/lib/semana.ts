import { useCallback, useEffect, useRef, useState } from 'react'
import { addDays } from './fechas'
import { supabase } from './supabase'
import { duracion } from './time'
import type { Asignacion, CierreDivision, Momento, OpcionTurno } from './types'

/** Nombre y color con que se guarda un turno "Otro" (horario a mano). */
export const OTRO = { nombre: 'Especial', color: 'especial' }

/** Un turno sin los campos que genera la base. */
export type FilaTurno = Pick<
  Asignacion,
  'empleado_id' | 'fecha_jornada' | 'tipo_turno_id' | 'nombre_turno' | 'color' | 'inicio_plan' | 'fin_plan' | 'horas_reales' | 'ausente' | 'momento'
>

/** Igual que en la base: desde las 16 (o antes de las 5) es noche. */
export function momentoPorHora(inicio: string): Momento {
  const h = Number(inicio.slice(0, 2))
  return h >= 16 || h < 5 ? 'noche' : 'dia'
}

export const NOMBRE_MOMENTO: Record<Momento, string> = { dia: 'día', noche: 'noche' }

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
    momento: a.momento ?? momentoPorHora(a.inicio_plan),
  }
}

/** Turno nuevo (sin horas reales ni ausencia) a partir de una opción del selector. */
export function filaDesdeOpcion(empleadoId: string, fecha: string, op: Exclude<OpcionTurno, null>): FilaTurno {
  const base =
    'tipo' in op
      ? {
          tipo_turno_id: op.tipo.id,
          nombre_turno: op.tipo.nombre,
          color: op.tipo.color,
          inicio_plan: op.tipo.inicio,
          fin_plan: op.tipo.fin,
          momento: op.tipo.momento ?? momentoPorHora(op.tipo.inicio),
        }
      : {
          tipo_turno_id: null,
          nombre_turno: OTRO.nombre,
          color: OTRO.color,
          inicio_plan: op.otro.inicio,
          fin_plan: op.otro.fin,
          momento: momentoPorHora(op.otro.inicio),
        }
  return { empleado_id: empleadoId, fecha_jornada: fecha, horas_reales: null, ausente: false, ...base }
}

/** Para copiar: mismo turno en otra fecha (o persona), sin horas reales ni ausencia. */
export function copiarFila(a: FilaTurno | Asignacion, cambios: Partial<Pick<FilaTurno, 'empleado_id' | 'fecha_jornada'>>): FilaTurno {
  return { ...aFila(a as Asignacion), horas_reales: null, ausente: false, ...cambios }
}

/** Horas que cuentan para propinas e historial: 0 si faltó, las corregidas si hay, si no las planificadas. */
export function horasReales(a: Pick<Asignacion, 'ausente' | 'horas_reales' | 'horas_plan'>): number {
  if (a.ausente) return 0
  return a.horas_reales === null || a.horas_reales === undefined ? Number(a.horas_plan) : Number(a.horas_reales)
}

const enCambio = (a: Asignacion, c: Cambio) =>
  a.fecha_jornada >= c.desde && a.fecha_jornada <= c.hasta && (c.empleado === null || a.empleado_id === c.empleado)

// Caché por semana: volver a una semana ya vista es instantáneo.
const cache = new Map<string, { asignaciones: Asignacion[]; cierres: CierreDivision[] }>()
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
  const [cierres, setCierresState] = useState<CierreDivision[]>(() => cache.get(key)?.cierres ?? [])
  const [loading, setLoading] = useState(!cache.has(key))
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const ref = useRef(asignaciones)
  const setAsignaciones = useCallback((next: Asignacion[]) => {
    ref.current = next
    setAsignacionesState(next)
  }, [])

  const refCierres = useRef(cierres)
  const setCierres = useCallback((next: CierreDivision[]) => {
    refCierres.current = next
    setCierresState(next)
  }, [])

  const cola = useRef<Promise<unknown>>(Promise.resolve())
  const pendientes = useRef(0)

  const reload = useCallback(async () => {
    if (!supabase) return
    const [a, c] = await Promise.all([
      supabase.from('asignaciones').select('*').eq('local_id', localId).gte('fecha_jornada', lunes).lte('fecha_jornada', domingo).order('inicio_plan'),
      supabase.from('cierres_division').select('*').eq('local_id', localId).gte('fecha', lunes).lte('fecha', domingo),
    ])
    if (pendientes.current > 0) return // hay cambios en curso: esperamos a que terminen
    if (a.error || c.error) {
      setError('No se pudieron cargar los turnos.')
    } else {
      const data = { asignaciones: a.data as Asignacion[], cierres: c.data as CierreDivision[] }
      cache.set(key, data)
      setAsignaciones(data.asignaciones)
      setCierres(data.cierres)
      setError(null)
    }
    setLoading(false)
  }, [localId, lunes, domingo, key, setAsignaciones, setCierres])

  /** Pone un guardado en la cola (uno por vez, en orden). Al vaciarse la cola se relee la base. */
  const encolar = useCallback(
    (tarea: () => Promise<boolean>): Promise<boolean> => {
      pendientes.current++
      setGuardando(true)
      const p = cola.current.then(async () => {
        let ok = false
        try {
          ok = await tarea()
        } catch {
          ok = false
        }
        pendientes.current--
        if (pendientes.current === 0) {
          setGuardando(false)
          await reload() // sincroniza ids reales y cierres (y deshace lo que no se pudo guardar)
        }
        return ok
      })
      cola.current = p
      return p
    },
    [reload],
  )

  useEffect(() => {
    const c = cache.get(key)
    setAsignaciones(c?.asignaciones ?? [])
    setCierres(c?.cierres ?? [])
    setLoading(!c)
    reload()
  }, [key, reload, setAsignaciones, setCierres])

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
      // Si un cambio toca una división confirmada, la base la reabre; se ve al releer.
      cache.set(key, { asignaciones: estado, cierres: refCierres.current })

      const guardado = encolar(async () => {
        if (!supabase) return true
        for (const c of cambios) {
          const { error } = await supabase.rpc('reemplazar_turnos', {
            p_local: localId,
            p_desde: c.desde,
            p_hasta: c.hasta,
            p_empleado: c.empleado,
            p_filas: c.filas,
          })
          if (error) return false
        }
        return true
      })
      return { deshacer, guardado }
    },
    [localId, key, encolar, setAsignaciones],
  )

  /** Corrige las horas reales o la ausencia de un turno ya cargado (cierre del día). */
  const actualizar = useCallback(
    (id: string, cambio: Partial<Pick<Asignacion, 'horas_reales' | 'ausente'>>): Promise<boolean> => {
      const antes = ref.current.find((a) => a.id === id)
      if (!antes || id.startsWith('tmp-')) return Promise.resolve(false)
      const nuevo = { ...antes, ...cambio }
      const estado = ref.current.map((a) => (a.id === id ? nuevo : a))
      setAsignaciones(estado)
      cache.set(key, { asignaciones: estado, cierres: refCierres.current })
      return encolar(async () => {
        if (!supabase) return true
        // La base controla que sea tu división y que el día no esté confirmado
        const { error } = await supabase.rpc('corregir_turno', {
          p_id: id,
          p_horas_reales: nuevo.horas_reales,
          p_ausente: nuevo.ausente,
        })
        return !error
      })
    },
    [key, encolar, setAsignaciones],
  )

  /** Confirma o reabre una división en un día. */
  const confirmarDivision = useCallback(
    (fecha: string, area_id: string, momento: Momento, confirmado: boolean): Promise<boolean> => {
      const previo = refCierres.current.find((c) => c.fecha === fecha && c.area_id === area_id && c.momento === momento)
      const fila: CierreDivision = {
        local_id: localId,
        fecha,
        area_id,
        momento,
        confirmado,
        confirmado_en: confirmado ? (previo?.confirmado ? previo.confirmado_en : new Date().toISOString()) : null,
        confirmado_por: confirmado ? (previo?.confirmado_por ?? null) : null,
      }
      const next = [...refCierres.current.filter((c) => c !== previo), fila]
      setCierres(next)
      cache.set(key, { asignaciones: ref.current, cierres: next })
      return encolar(async () => {
        if (!supabase) return true
        const { error } = await supabase
          .from('cierres_division')
          .upsert({ local_id: localId, fecha, area_id, momento, confirmado }, { onConflict: 'local_id,fecha,area_id,momento' })
        return !error
      })
    },
    [localId, key, encolar, setCierres],
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

  return { asignaciones, cierres, loading, error, guardando, reload, aplicar, actualizar, confirmarDivision, leerRango, domingo }
}
