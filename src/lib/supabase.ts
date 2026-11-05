import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** true cuando las variables de entorno de Supabase están cargadas. */
export const supabaseConfigured = Boolean(url && anonKey)

/**
 * Cliente de Supabase. Es null hasta que se configuren
 * VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver README).
 */
export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null
