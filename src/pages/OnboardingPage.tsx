import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { useLocal } from '../lib/local'

/** Primera vez que entra un encargado sin local: pide el nombre y lo crea. */
export function OnboardingPage() {
  const { crearLocal } = useLocal()
  const { signOut } = useAuth()
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
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-8 px-5 py-10">
      <div className="flex flex-col gap-2">
        <span className="self-start rounded-full border border-tarde-bd bg-tarde-bg px-2.5 py-0.5 text-xs font-medium text-tarde-fg">
          Bienvenido a Lineup
        </span>
        <h1 className="m-0 text-3xl font-bold tracking-tight">¿Cómo se llama el restaurante?</h1>
        <p className="m-0 text-sm text-muted">
          Vamos a dejar listo Salón y Cocina, y los turnos Mañana 09–17, Tarde 12–20 y Noche 17–01. Después los podés
          cambiar en Configuración.
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
          Nombre del local
          <input
            required
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
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
          disabled={busy || !nombre.trim()}
          className="h-12 rounded-xl bg-olive text-[15px] font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Creando…' : 'Empezar'}
        </button>
      </form>
      <button type="button" onClick={signOut} className="h-11 self-center text-sm font-medium text-muted underline underline-offset-4">
        Cerrar sesión
      </button>
    </div>
  )
}
