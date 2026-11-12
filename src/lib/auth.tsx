import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

type AuthState = {
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  /** Crea la cuenta. Devuelve error, o 'confirmar' si hay que validar el email. */
  signUp: (email: string, password: string) => Promise<string | null | 'confirmar'>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    if (!supabase) return 'La app todavía no está conectada a la base de datos.'
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) return null
    return error.message === 'Invalid login credentials'
      ? 'Email o contraseña incorrectos.'
      : 'No se pudo iniciar sesión. Probá de nuevo.'
  }

  const signUp = async (email: string, password: string) => {
    if (!supabase) return 'La app todavía no está conectada a la base de datos.'
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
    if (error) {
      if (/password/i.test(error.message)) return 'La contraseña tiene que tener al menos 6 caracteres.'
      if (/registered|exists/i.test(error.message)) return 'Ese email ya tiene cuenta. Entrá con tu contraseña.'
      return 'No se pudo crear la cuenta. Probá de nuevo.'
    }
    return data.session ? null : 'confirmar'
  }

  const signOut = async () => {
    await supabase?.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signUp, signOut }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
