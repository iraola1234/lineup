import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import { supabase } from './supabase'
import type { Local } from './types'

type LocalState = {
  local: Local | null
  loading: boolean
  error: string | null
  crearLocal: (nombre: string) => Promise<string | null>
  renombrar: (nombre: string) => Promise<string | null>
}

const LocalContext = createContext<LocalState | null>(null)

/** Carga el local del usuario (hoy: uno solo; el modelo admite varios). */
export function LocalProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [local, setLocal] = useState<Local | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!supabase || !session) return
    setLoading(true)
    const { data, error } = await supabase
      .from('locales')
      .select('id, nombre')
      .order('creado_en', { ascending: true })
      .limit(1)
    if (error) setError('No se pudo cargar el local.')
    else setLocal((data?.[0] as Local) ?? null)
    setLoading(false)
  }, [session])

  useEffect(() => {
    cargar()
  }, [cargar])

  const crearLocal = async (nombre: string) => {
    if (!supabase) return 'Sin conexión a la base de datos.'
    const { error } = await supabase.rpc('crear_local', { p_nombre: nombre })
    if (error) return 'No se pudo crear el local. Probá de nuevo.'
    await cargar()
    return null
  }

  const renombrar = async (nombre: string) => {
    if (!supabase || !local) return 'Sin conexión a la base de datos.'
    const { error } = await supabase.from('locales').update({ nombre }).eq('id', local.id)
    if (error) return 'No se pudo guardar el nombre.'
    setLocal({ ...local, nombre })
    return null
  }

  return (
    <LocalContext.Provider value={{ local, loading, error, crearLocal, renombrar }}>
      {children}
    </LocalContext.Provider>
  )
}

export function useLocal() {
  const ctx = useContext(LocalContext)
  if (!ctx) throw new Error('useLocal debe usarse dentro de LocalProvider')
  return ctx
}

/** Igual que useLocal pero garantiza que hay local (usar dentro de las pantallas de la app). */
export function useLocalId(): string {
  const { local } = useLocal()
  if (!local) throw new Error('No hay local activo')
  return local.id
}
