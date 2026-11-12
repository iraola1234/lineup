import { Eye, EyeOff, MailCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, Field, Notice, TextInput } from '../components/ui'
import { useAuth } from '../lib/auth'
import { supabaseConfigured } from '../lib/supabase'

export function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar')
  const [enviado, setEnviado] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [ver, setVer] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    if (modo === 'entrar') setError(await signIn(email.trim(), password))
    else {
      const r = await signUp(email.trim().toLowerCase(), password)
      if (r === 'confirmar') setEnviado(true)
      else setError(r)
    }
    setBusy(false)
  }


  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-ground px-5 py-10">
      <main className="flex w-full max-w-[400px] flex-col gap-6">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-11 rounded-xl" />
          <span className="flex flex-col leading-tight">
            <span className="text-lg font-semibold tracking-tight">Mansalva</span>
            <span className="text-[11px] font-medium tracking-wide text-muted uppercase">Backoffice</span>
          </span>
        </div>

        <div className="flex flex-col gap-6 rounded-2xl border border-line bg-card p-6 shadow-card sm:p-7">
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">{modo === 'entrar' ? 'Iniciar sesión' : 'Crear tu cuenta'}</h1>
            <p className="m-0 text-sm text-muted">
              {modo === 'entrar' ? 'Con tu email y contraseña.' : 'Usá el mismo email con el que te dieron acceso.'}
            </p>
          </div>

          {!supabaseConfigured ? (
            <Notice tone="error">
              Falta conectar la base de datos. Cargá VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver README).
            </Notice>
          ) : enviado ? (
            <div className="flex flex-col items-start gap-4 rounded-2xl border border-line bg-card p-5 shadow-card">
              <span className="flex size-11 items-center justify-center rounded-xl bg-olive-soft text-olive">
                <MailCheck size={22} />
              </span>
              <div className="flex flex-col gap-1">
                <p className="m-0 text-[15px] font-semibold">Revisá tu email</p>
                <p className="m-0 text-sm text-muted">
                  Te mandamos un link a <span className="font-medium text-ink">{email.trim().toLowerCase()}</span> para confirmar la cuenta. Después entrá acá con tu contraseña.
                </p>
              </div>
              <Button
                onClick={() => {
                  setEnviado(false)
                  setModo('entrar')
                }}
              >
                Ya confirmé, entrar
              </Button>
            </div>
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
                      autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                      minLength={modo === 'crear' ? 6 : undefined}
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
                {modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
              </Button>
            </form>
          )}
        </div>
        <p className="m-0 text-center text-xs text-faint">Acceso solo para el equipo de Mansalva.</p>
      </main>
    </div>
  )
}
