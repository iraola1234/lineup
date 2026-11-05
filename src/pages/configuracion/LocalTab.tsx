import { useState } from 'react'
import { Button, Field, Notice, TextInput } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { useLocal } from '../../lib/local'

export function LocalTab() {
  const { local, renombrar } = useLocal()
  const { session, signOut } = useAuth()
  const [nombre, setNombre] = useState(local?.nombre ?? '')
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const guardar = async () => {
    const n = nombre.trim()
    if (!n) return
    setBusy(true)
    const err = await renombrar(n)
    setBusy(false)
    setMsg(err ? { tone: 'error', text: err } : { tone: 'ok', text: 'Nombre guardado.' })
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4 lg:p-5">
        <Field label="Nombre del restaurante" hint="Aparece en el menú y en la imagen para WhatsApp.">
          {(id) => <TextInput id={id} value={nombre} onChange={(e) => setNombre(e.target.value)} />}
        </Field>
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        <Button
          variant="primary"
          className="self-start"
          onClick={guardar}
          disabled={busy || !nombre.trim() || nombre.trim() === local?.nombre}
        >
          {busy ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 lg:p-5">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-muted">Sesión iniciada como</span>
          <span className="text-[15px] font-semibold">{session?.user.email}</span>
        </div>
        <Button className="self-start" onClick={signOut}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  )
}
