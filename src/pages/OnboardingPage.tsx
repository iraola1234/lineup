import { Check } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, Field, Notice, TextInput } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useLocal } from '../lib/local'

/** Primera vez que entra alguien sin local: lo crea (dueño) o espera la invitación (usuario invitado). */
export function OnboardingPage() {
  const { crearLocal, recargar } = useLocal()
  const { signOut, session } = useAuth()
  const [revisando, setRevisando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const n = nombre.trim()
    if (!n) return
    setBusy(true)
    setError(await crearLocal(n))
    setBusy(false)
  }

  return (
    <div className="mx-auto flex min-h-full max-w-[440px] flex-col justify-center gap-8 px-5 py-10">
      <img src="/favicon.svg" alt="" className="size-12 rounded-2xl" />
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-[28px] leading-tight font-semibold tracking-[-0.02em]">Bienvenido. ¿Cómo se llama el restaurante?</h1>
        <p className="m-0 text-sm text-muted">Vamos a dejar todo listo para que armes tu primera semana.</p>
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 text-[13px] text-ink-2 shadow-card">
        <p className="m-0">
          <span className="font-semibold text-ink">¿Te dieron acceso?</span> No crees un local nuevo: pedile al administrador que te invite con{' '}
          <span className="font-medium text-ink">{session?.user.email}</span> y después tocá revisar.
        </p>
        <Button
          size="sm"
          loading={revisando}
          onClick={async () => {
            setRevisando(true)
            await recargar()
            setRevisando(false)
          }}
          className="self-start"
        >
          Revisar invitación
        </Button>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Nombre del local">
          {(id) => <TextInput id={id} required autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: La Huella" />}
        </Field>
        <ul className="m-0 flex list-none flex-col gap-2 rounded-2xl border border-line bg-card p-4 text-[13px] text-ink-2">
          {['Áreas Salón y Cocina', 'Turnos Mañana 09–17, Tarde 12–20 y Noche 17–01', 'Todo se puede cambiar después en Configuración'].map((t) => (
            <li key={t} className="flex items-start gap-2.5">
              <span className="mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full bg-olive-soft text-olive">
                <Check size={11} strokeWidth={3} />
              </span>
              {t}
            </li>
          ))}
        </ul>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" variant="primary" size="lg" loading={busy} disabled={!nombre.trim()} className="w-full">
          Empezar
        </Button>
      </form>
      <Button variant="ghost" onClick={signOut} className="self-center">
        Cerrar sesión
      </Button>
    </div>
  )
}
