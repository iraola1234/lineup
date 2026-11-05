import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

/** Lee todas las filas de una tabla para el local activo, ordenadas. */
export function useTabla<T>(tabla: string, localId: string, orden: { col: string; asc?: boolean }[] = []) {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const ordenKey = JSON.stringify(orden)

  const reload = useCallback(async () => {
    if (!supabase) return
    let q = supabase.from(tabla).select('*').eq('local_id', localId)
    for (const o of JSON.parse(ordenKey) as { col: string; asc?: boolean }[]) {
      q = q.order(o.col, { ascending: o.asc ?? true })
    }
    const { data, error } = await q
    if (error) setError('No se pudieron cargar los datos.')
    else {
      setRows((data ?? []) as T[])
      setError(null)
    }
    setLoading(false)
  }, [tabla, localId, ordenKey])

  useEffect(() => {
    reload()
  }, [reload])

  return { rows, loading, error, reload }
}

/** Código de Postgres para "hay filas que dependen de esta" (clave foránea). */
export const FK_VIOLATION = '23503'
