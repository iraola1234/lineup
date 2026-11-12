import { Eye, EyeOff } from 'lucide-react'
import { createContext, useContext, useState, type FormEvent, type ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import { nombreDivision } from '../lib/divisiones'
import { useLocal } from '../lib/local'
import { supabase } from '../lib/supabase'
import { useToast } from './toast'
import { Avatar, Button, Field, Notice, Sheet, TextInput } from './ui'

const CuentaContext = createContext<() => void>(() => {})

/** Abre el panel "Mi cuenta" desde cualquier pantalla. */
export const useAbrirCuenta = () => useContext(CuentaContext)

export function CuentaProvider({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <CuentaContext.Provider value={() => setAbierto(true)}>
      {children}
      <MiCuenta open={abierto} onClose={() => setAbierto(false)} />
    </CuentaContext.Provider>
  )
}

function MiCuenta({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session } = useAuth()
  const { esAdmin, misDivisiones, miEmpleadoId } = useLocal()
  const { areas, empleados } = useData()
  const toast = useToast()
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [ver, setVer] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const email = session?.user.email ?? ''
  const rol = esAdmin ? 'Administrador' : misDivisiones.length ? `Encargado · ${misDivisiones.map((d) => nombreDivision(areas, d)).join(', ')}` : 'Encargado'
  const ficha = empleados.find((e) => e.id === miEmpleadoId)
  const coinciden = nueva === repetir
  const valido = nueva.length >= 8 && coinciden

  const cerrar = () => {
    setNueva('')
    setRepetir('')
    setError(null)
    setVer(false)
    onClose()
  }

  const guardar = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!supabase || !valido) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password: nueva })
    setBusy(false)
    if (error) {
      setError(
        /different|same/i.test(error.message)
          ? 'La nueva contraseña tiene que ser distinta a la actual.'
          : /reauth|recent/i.test(error.message)
            ? 'Por seguridad, cerrá sesión, volvé a entrar y probá de nuevo.'
            : 'No se pudo cambiar la contraseña. Probá de nuevo.',
      )
      return
    }
    toast.show('Contraseña cambiada')
    cerrar()
  }

  return (
    <Sheet
      open={open}
      onClose={cerrar}
      title="Mi cuenta"
      subtitle={email}
      leading={<Avatar nombre={email || 'Usuario'} size={40} />}
      footer={
        <>
          <span className="flex-1" />
          <Button onClick={cerrar}>Cancelar</Button>
          <Button variant="primary" onClick={() => guardar()} disabled={!valido} loading={busy}>
            Cambiar contraseña
          </Button>
        </>
      }
    >
      <dl className="m-0 flex flex-col overflow-hidden rounded-2xl border border-line">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <dt className="text-[13px] text-muted">Rol</dt>
          <dd className="m-0 truncate text-[13px] font-semibold">{rol}</dd>
        </div>
        {ficha && (
          <div className="flex items-center justify-between gap-3 border-t border-divider px-4 py-3">
            <dt className="text-[13px] text-muted">Ficha de empleado</dt>
            <dd className="m-0 truncate text-[13px] font-semibold">{ficha.nombre}</dd>
          </div>
        )}
      </dl>

      <form onSubmit={guardar} className="flex flex-col gap-4">
        <h3 className="m-0 text-[15px] font-semibold">Cambiar contraseña</h3>
        <Field label="Nueva contraseña" hint="Mínimo 8 caracteres." error={nueva && nueva.length < 8 ? 'Tiene que tener al menos 8 caracteres.' : null}>
          {(id) => (
            <div className="relative">
              <TextInput id={id} type={ver ? 'text' : 'password'} autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} className="pr-12" />
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
        <Field label="Repetir contraseña" error={repetir && !coinciden ? 'No coincide con la nueva contraseña.' : null}>
          {(id) => <TextInput id={id} type={ver ? 'text' : 'password'} autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} />}
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  )
}
