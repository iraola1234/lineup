import { useCallback, useEffect, useState } from 'react'
import { addDays } from './fechas'
import { supabase } from './supabase'
import { duracion } from './time'
import type { Asignacion, DiaCierre, OpcionTurno } from './types'

/** Nombre y color con que se guarda un turno "Otro" (horario a mano). */
export const OTRO = { nombre: 'Especial', color: 'especial' }

type Resultado = { ok: boolean; mensaje: string }

/** Columnas que se copian al duplicar un turno (sin id, horas reales ni ausencia). */
function copia(a: Asignacion, fecha: string) {
  return {
    local_id: a.local_id,
    empleado_id: a.empleado_id,
    fecha_jornada: fecha,
    tipo_turno_id: a.tipo_turno_id,
    nombre_turno: a.nombre_turno,
    color: a.color,
    inicio_plan: a.inicio_plan,
    fin_plan: a.fin_plan,
  }
}

/**
 * Turnos de una semana (lunes a domingo) y las acciones para editarlos.
 * `activos` = ids de empleados activos (al copiar no se arrastra a los dados de baja).
 */
export function useSemana(localId: string, lunes: string, activos: Set<string>) {
  const domingo = addDays(lunes, 6)
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [cierres, setCierres] = useState<DiaCierre[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!supabase) return
    const [a, c] = await Promise.all([
      supabase
        .from('asignaciones')
        .select('*')
        .eq('local_id', localId)
        .gte('fecha_jornada', lunes)
        .lte('fecha_jornada', domingo)
        .order('inicio_plan'),
      supabase.from('dias_cierre').select('*').eq('local_id', localId).gte('fecha', lunes).lte('fecha', domingo),
    ])
    if (a.error || c.error) {
      setError('No se pudieron cargar los turnos.')
    } else {
      setAsignaciones((a.data ?? []) as Asignacion[])
      setCierres((c.data ?? []) as DiaCierre[])
      setError(null)
    }
    setLoading(false)
  }, [localId, lunes, domingo])

  useEffect(() => {
    setLoading(true)
    reload()
  }, [reload])

  /** Copiar o borrar un día cambia sus horas: si estaba confirmado, vuelve a pendiente. */
  const reabrir = async (fechas: string[]) => {
    const confirmadas = cierres.filter((c) => c.confirmado && fechas.includes(c.fecha)).map((c) => c.fecha)
    if (!supabase || confirmadas.length === 0) return
    await supabase
      .from('dias_cierre')
      .upsert(confirmadas.map((fecha) => ({ local_id: localId, fecha, confirmado: false, confirmado_en: null })), {
        onConflict: 'local_id,fecha',
      })
  }

  /** Asigna (o quita) el turno de una persona en un día. Reemplaza lo que tuviera ese día. */
  const asignar = async (empleadoId: string, fecha: string, opcion: OpcionTurno): Promise<Resultado> => {
    if (!supabase) return { ok: false, mensaje: 'Sin conexión.' }

    const fila =
      opcion === null
        ? null
        : 'tipo' in opcion
          ? {
              tipo_turno_id: opcion.tipo.id,
              nombre_turno: opcion.tipo.nombre,
              color: opcion.tipo.color,
              inicio_plan: opcion.tipo.inicio,
              fin_plan: opcion.tipo.fin,
            }
          : {
              tipo_turno_id: null,
              nombre_turno: OTRO.nombre,
              color: OTRO.color,
              inicio_plan: opcion.otro.inicio,
              fin_plan: opcion.otro.fin,
            }

    // Actualización inmediata en pantalla; después se confirma con la base.
    setAsignaciones((prev) => {
      const resto = prev.filter((a) => !(a.empleado_id === empleadoId && a.fecha_jornada === fecha))
      if (!fila) return resto
      return [
        ...resto,
        {
          id: `tmp-${empleadoId}-${fecha}`,
          local_id: localId,
          empleado_id: empleadoId,
          fecha_jornada: fecha,
          horas_plan: duracion(fila.inicio_plan, fila.fin_plan),
          horas_reales: null,
          ausente: false,
          ...fila,
        },
      ]
    })

    const del = await supabase
      .from('asignaciones')
      .delete()
      .eq('local_id', localId)
      .eq('empleado_id', empleadoId)
      .eq('fecha_jornada', fecha)
    const ins = fila
      ? await supabase.from('asignaciones').insert({ local_id: localId, empleado_id: empleadoId, fecha_jornada: fecha, ...fila })
      : { error: null }
    await reload()
    if (del.error || ins.error) return { ok: false, mensaje: 'No se pudo guardar el turno. Probá de nuevo.' }
    return { ok: true, mensaje: '' }
  }

  /** Reemplaza los turnos de `destino` por los de `origen` (misma lista de días, desplazada). */
  const copiar = async (origenDesde: string, origenHasta: string, offsetDias: number, destDesde: string, destHasta: string) => {
    if (!supabase) return { ok: false, n: 0 }
    const src = await supabase
      .from('asignaciones')
      .select('*')
      .eq('local_id', localId)
      .gte('fecha_jornada', origenDesde)
      .lte('fecha_jornada', origenHasta)
    if (src.error) return { ok: false, n: 0 }
    const filas = ((src.data ?? []) as Asignacion[])
      .filter((a) => activos.has(a.empleado_id))
      .map((a) => copia(a, addDays(a.fecha_jornada, offsetDias)))
    const del = await supabase
      .from('asignaciones')
      .delete()
      .eq('local_id', localId)
      .gte('fecha_jornada', destDesde)
      .lte('fecha_jornada', destHasta)
    if (del.error) return { ok: false, n: 0 }
    if (filas.length > 0) {
      const ins = await supabase.from('asignaciones').insert(filas)
      if (ins.error) return { ok: false, n: 0 }
    }
    return { ok: true, n: filas.length }
  }

  const copiarSemanaAnterior = async (): Promise<Resultado> => {
    const r = await copiar(addDays(lunes, -7), addDays(domingo, -7), 7, lunes, domingo)
    if (r.ok) await reabrir(Array.from({ length: 7 }, (_, i) => addDays(lunes, i)))
    await reload()
    if (!r.ok) return { ok: false, mensaje: 'No se pudo copiar la semana. Probá de nuevo.' }
    if (r.n === 0) return { ok: true, mensaje: 'La semana anterior estaba vacía, así que esta quedó vacía.' }
    return { ok: true, mensaje: `Se copiaron ${r.n} turnos de la semana anterior.` }
  }

  const copiarDiaAnterior = async (fecha: string): Promise<Resultado> => {
    const ayer = addDays(fecha, -1)
    const r = await copiar(ayer, ayer, 1, fecha, fecha)
    if (r.ok) await reabrir([fecha])
    await reload()
    if (!r.ok) return { ok: false, mensaje: 'No se pudo copiar el día. Probá de nuevo.' }
    if (r.n === 0) return { ok: true, mensaje: 'El día anterior estaba vacío, así que este quedó vacío.' }
    return { ok: true, mensaje: `Se copiaron ${r.n} turnos del día anterior.` }
  }

  const restablecerDia = async (fecha: string): Promise<Resultado> => {
    if (!supabase) return { ok: false, mensaje: 'Sin conexión.' }
    const del = await supabase.from('asignaciones').delete().eq('local_id', localId).eq('fecha_jornada', fecha)
    if (!del.error) await reabrir([fecha])
    await reload()
    if (del.error) return { ok: false, mensaje: 'No se pudo restablecer el día. Probá de nuevo.' }
    return { ok: true, mensaje: 'El día quedó vacío.' }
  }

  return {
    asignaciones,
    cierres,
    loading,
    error,
    reload,
    asignar,
    copiarSemanaAnterior,
    copiarDiaAnterior,
    restablecerDia,
  }
}
