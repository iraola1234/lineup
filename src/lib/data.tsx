import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { Area, Empleado, TipoTurno } from './types'

type Data = {
  areas: Area[]
  empleados: Empleado[]
  tipos: TipoTurno[] // todos, incluidos archivados
  tiposActivos: TipoTurno[]
  /** true solo en la primera carga (después se actualiza en segundo plano). */
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const DataContext = createContext<Data | null>(null)

/**
 * Equipo, áreas y tipos de turno del local, cargados una vez y compartidos
 * por todas las pantallas. Así navegar entre secciones es instantáneo.
 */
export function DataProvider({ localId, children }: { localId: string; children: ReactNode }) {
  const [areas, setAreas] = useState<Area[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [tipos, setTipos] = useState<TipoTurno[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase) return
    const [a, e, t] = await Promise.all([
      supabase.from('areas').select('*').eq('local_id', localId).order('orden').order('nombre'),
      supabase.from('empleados').select('*').eq('local_id', localId).order('orden').order('nombre'),
      supabase.from('tipos_turno').select('*').eq('local_id', localId).order('orden').order('inicio'),
    ])
    if (a.error || e.error || t.error) {
      setError('No se pudieron cargar los datos del local.')
    } else {
      setAreas(a.data as Area[])
      setEmpleados(e.data as Empleado[])
      setTipos(t.data as TipoTurno[])
      setError(null)
    }
    setLoading(false)
  }, [localId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo(
    () => ({ areas, empleados, tipos, tiposActivos: tipos.filter((t) => !t.archivado), loading, error, refresh }),
    [areas, empleados, tipos, loading, error, refresh],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData debe usarse dentro de DataProvider')
  return ctx
}
