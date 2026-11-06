import { LogOut, Store } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '../../components/toast'
import { Avatar, Button, Field, TextInput } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { useLocal } from '../../lib/local'

export function LocalTab() {
  const { local, renombrar } = useLocal()
  const { session, signOut } = useAuth()
  const toast = useToast()
  const [nombre, setNombre] = useState(local?.nombre ?? '')
  const [busy, setBusy] = useState(false)

  const guardar = async () => {
    const n = nombre.trim()
    if (!n) return
    setBusy(true)
    const err = await renombrar(n)
    setBusy(false)
    toast.show(err ?? 'Nombre guardado', { tone: err ? 'error' : 'ok' })
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-card">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-olive-soft text-olive">
            <Store size={20} />
          </span>
          <div className="flex flex-col">
            <h3 className="m-0 text-[15px] font-semibold">Datos del local</h3>
            <span className="text-xs text-muted">Aparecen en el menú y en la imagen para WhatsApp.</span>
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            guardar()
          }}
          className="flex flex-col gap-4"
        >
          <Field label="Nombre del restaurante">
            {(id) => <TextInput id={id} value={nombre} onChange={(e) => setNombre(e.target.value)} />}
          </Field>
          <Button type="submit" variant="primary" className="self-start" loading={busy} disabled={!nombre.trim() || nombre.trim() === local?.nombre}>
            Guardar
          </Button>
        </form>
      </section>

      <section className="flex items-center gap-3 rounded-2xl border border-line bg-card p-5 shadow-card">
        <Avatar nombre={session?.user.email ?? 'E'} size={40} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs text-muted">Sesión iniciada como</span>
          <span className="truncate text-[15px] font-semibold">{session?.user.email}</span>
        </div>
        <Button onClick={signOut} icon={<LogOut size={16} />}>
          Salir
        </Button>
      </section>
    </div>
  )
}
