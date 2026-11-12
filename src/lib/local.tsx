import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import { supabase } from './supabase'
import type { Division, Local, Momento, Rol } from './types'

type LocalState = {
  local: Local | null
  loading: boolean
  error: string | null
  rol: Rol | null
  esAdmin: boolean
  /** Divisiones que este usuario confirma (el admin, todas). */
  misDivisiones: Division[]
  puedoCerrar: (area_id: string, momento: Momento) => boolean
  recargar: () => Promise<void>
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
  const [rol, setRol] = useState<Rol | null>(null)
  const [misDivisiones, setMisDivisiones] = useState<Division[]>([])

  const cargar = useCallback(async () => {
    if (!supabase || !session) return
    setLoading(true)
    // Si alguien invitó a este email, entra a ese local
    await supabase.rpc('aceptar_invitaciones')
    const uid = session.user.id
    const { data: m, error } = await supabase
      .from('miembros')
      .select('rol, local_id, locales(id, nombre, creado_en)')
      .eq('usuario_id', uid)
    if (error) {
      setError('No se pudo cargar el local.')
      setLoading(false)
      return
    }
    type FilaMiembro = { rol: Rol; local_id: string; locales: (Local & { creado_en: string }) | null }
    const filas = ((m ?? []) as unknown as FilaMiembro[]).filter((f) => f.locales)
    // Primero el local donde es admin; si no, el más antiguo
    filas.sort((a, b) => (a.rol === b.rol ? a.locales!.creado_en.localeCompare(b.locales!.creado_en) : a.rol === 'admin' ? -1 : 1))
    const f = filas[0]
    if (!f) {
      setLocal(null)
      setRol(null)
      setMisDivisiones([])
    } else {
      setLocal({ id: f.locales!.id, nombre: f.locales!.nombre })
      setRol(f.rol)
      const { data: d } = await supabase.from('miembro_divisiones').select('area_id, momento').eq('local_id', f.local_id).eq('usuario_id', uid)
      setMisDivisiones((d ?? []) as Division[])
    }
    setError(null)
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

  const esAdmin = rol === 'admin'
  const puedoCerrar = useCallback(
    (area_id: string, momento: Momento) => esAdmin || misDivisiones.some((d) => d.area_id === area_id && d.momento === momento),
    [esAdmin, misDivisiones],
  )

  return (
    <LocalContext.Provider value={{ local, loading, error, rol, esAdmin, misDivisiones, puedoCerrar, recargar: cargar, crearLocal, renombrar }}>
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
