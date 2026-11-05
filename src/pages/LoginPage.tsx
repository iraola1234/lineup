import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { supabaseConfigured } from '../lib/supabase'

export function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(await signIn(email.trim(), password))
    setBusy(false)
  }

  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center gap-8 px-5 py-10">
      <div className="flex flex-col items-start gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-olive font-mono text-lg font-bold text-white">
          L
        </span>
        <div>
          <h1 className="m-0 text-3xl font-bold tracking-tight">Lineup</h1>
          <p className="m-0 mt-1 text-sm text-muted">Horarios, horas y propinas del equipo.</p>
        </div>
      </div>

      {!supabaseConfigured ? (
        <div className="rounded-2xl border border-manana-bd bg-manana-bg p-4 text-sm text-manana-fg">
          Falta conectar la base de datos. Cargá <span className="font-mono">VITE_SUPABASE_URL</span> y{' '}
          <span className="font-mono">VITE_SUPABASE_ANON_KEY</span> (ver README).
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-xl border border-line bg-head px-3 text-base text-ink"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
            Contraseña
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-xl border border-line bg-head px-3 text-base text-ink"
            />
          </label>
          {error && (
            <p role="alert" className="m-0 text-sm text-danger">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="h-12 rounded-xl bg-olive text-[15px] font-semibold text-white disabled:opacity-60"
          >
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      )}
    </div>
  )
}
