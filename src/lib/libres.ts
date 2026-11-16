import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'

export type DiaLibre = { local_id: string; empleado_id: string; fecha: string }

const clave = (empleadoId: string, fecha: string) => `${empleadoId}|${fecha}`
const cache = new Map<string, DiaLibre[]>()

/**
 * Días libres marcados (pedidos con antelación) en un rango de fechas.
 * Para los cálculos valen igual que no tener turno; acá solo se leen y marcan.
 */
export function useLibres(localId: string, desde: string, hasta: string) {
  const key = `${localId}|${desde}|${hasta}`
  const [libres, setLibresState] = useState<DiaLibre[]>(() => cache.get(key) ?? [])
  const [cargado, setCargado] = useState(cache.has(key))
  const ref = useRef(libres)
  const setLibres = useCallback(
    (next: DiaLibre[]) => {
      ref.current = next
      cache.set(key, next)
      setLibresState(next)
    },
    [key],
  )

  const reload = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase.from('dias_libres').select('local_id, empleado_id, fecha').eq('local_id', localId).gte('fecha', desde).lte('fecha', hasta)
    if (!error) setLibres((data ?? []) as DiaLibre[])
    setCargado(true)
  }, [localId, desde, hasta, setLibres])

  useEffect(() => {
    const c = cache.get(key)
    ref.current = c ?? []
    setLibresState(c ?? [])
    setCargado(!!c)
    reload()
  }, [key, reload])

  const indice = useMemo(() => new Set(libres.map((l) => clave(l.empleado_id, l.fecha))), [libres])
  const esLibre = useCallback((empleadoId: string, fecha: string) => indice.has(clave(empleadoId, fecha)), [indice])

  /** Marca o desmarca un día libre. Devuelve si se guardó. */
  const marcar = useCallback(
    async (empleadoId: string, fecha: string, on: boolean): Promise<boolean> => {
      const ya = ref.current.some((l) => l.empleado_id === empleadoId && l.fecha === fecha)
      if (ya === on || !supabase) return true
      const antes = ref.current
      setLibres(on ? [...antes, { local_id: localId, empleado_id: empleadoId, fecha }] : antes.filter((l) => !(l.empleado_id === empleadoId && l.fecha === fecha)))
      const { error } = on
        ? await supabase.from('dias_libres').upsert({ local_id: localId, empleado_id: empleadoId, fecha }, { onConflict: 'empleado_id,fecha' })
        : await supabase.from('dias_libres').delete().eq('empleado_id', empleadoId).eq('fecha', fecha)
      if (error) setLibres(antes)
      return !error
    },
    [localId, setLibres],
  )

  return { libres, esLibre, marcar, cargado, reload }
}
