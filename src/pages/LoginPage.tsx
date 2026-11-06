import { CalendarDays, Clock3, Eye, EyeOff, Wallet } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, Field, Notice, TextInput } from '../components/ui'
import { useAuth } from '../lib/auth'
import { supabaseConfigured } from '../lib/supabase'

export function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [ver, setVer] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(await signIn(email.trim(), password))
    setBusy(false)
  }

  return (
    <div className="flex min-h-full">
      {/* Panel de marca (computadora) */}
      <aside className="relative hidden w-[44%] max-w-[620px] flex-col justify-between overflow-hidden bg-olive p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" className="size-9 rounded-xl ring-1 ring-white/20" />
          <span className="text-lg font-semibold tracking-tight">Lineup</span>
        </div>
        <div className="flex flex-col gap-8">
          <h1 className="m-0 max-w-md text-[40px] leading-[1.1] font-semibold tracking-[-0.03em]">Los horarios del equipo, resueltos en minutos.</h1>
          <ul className="m-0 flex list-none flex-col gap-4 p-0 text-[15px] text-white/85">
            <li className="flex items-center gap-3">
              <CalendarDays size={20} className="text-[#C9D6A8]" aria-hidden="true" /> Armá la semana y mandala al grupo
            </li>
            <li className="flex items-center gap-3">
              <Clock3 size={20} className="text-[#C9D6A8]" aria-hidden="true" /> Registrá las horas reales de cada día
            </li>
            <li className="flex items-center gap-3">
              <Wallet size={20} className="text-[#C9D6A8]" aria-hidden="true" /> Repartí las propinas sin calculadora
            </li>
          </ul>
        </div>
        <span className="text-xs text-white/50">Hecho para restaurantes</span>
        <div aria-hidden="true" className="absolute -right-24 -bottom-24 size-80 rounded-full bg-khaki/25" />
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="flex w-full max-w-[380px] flex-col gap-8">
          <div className="flex flex-col items-start gap-4 lg:hidden">
            <img src="/favicon.svg" alt="" className="size-12 rounded-2xl" />
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className="m-0 text-[26px] font-semibold tracking-[-0.02em]">Entrar a Lineup</h2>
            <p className="m-0 text-sm text-muted">Con el email y la contraseña del encargado.</p>
          </div>

          {!supabaseConfigured ? (
            <Notice tone="error">
              Falta conectar la base de datos. Cargá VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver README).
            </Notice>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <Field label="Email">
                {(id) => <TextInput id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
              </Field>
              <Field label="Contraseña">
                {(id) => (
                  <div className="relative">
                    <TextInput
                      id={id}
                      type={ver ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setVer((v) => !v)}
                      aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-ink"
                    >
                      {ver ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                )}
              </Field>
              {error && <Notice tone="error">{error}</Notice>}
              <Button type="submit" variant="primary" size="lg" loading={busy} className="mt-1 w-full">
                Entrar
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
