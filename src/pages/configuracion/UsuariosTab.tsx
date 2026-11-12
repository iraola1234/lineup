import { Check, Copy, Crown, Mail, Plus, ShieldCheck, Trash2, UserCog } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useToast } from '../../components/toast'
import { Avatar, Button, ConfirmDialog, Field, Notice, Pill, Segmented, Sheet, Skeleton, TextInput, pillNeutral, pillOk, pillWarn } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { useData } from '../../lib/data'
import { claveDivision, mismaDivision, nombreDivision, todasLasDivisiones } from '../../lib/divisiones'
import { useLocal, useLocalId } from '../../lib/local'
import { supabase } from '../../lib/supabase'
import type { Division, Invitacion, Miembro, Rol } from '../../lib/types'

type Persona = Miembro & { divisiones: Division[] }
type Draft = {
  modo: 'invitar' | 'editar'
  usuario_id?: string
  email: string
  nombre: string
  rol: Rol
  divisiones: Division[]
}

const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())

export function UsuariosTab() {
  const localId = useLocalId()
  const { local } = useLocal()
  const { session } = useAuth()
  const { areas } = useData()
  const toast = useToast()
  const [personas, setPersonas] = useState<Persona[] | null>(null)
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [quitar, setQuitar] = useState<{ tipo: 'miembro' | 'invitacion'; id: string; nombre: string } | null>(null)

  const cargar = useCallback(async () => {
    if (!supabase) return
    const [m, d, i] = await Promise.all([
      supabase.from('miembros').select('usuario_id, local_id, rol, email, nombre').eq('local_id', localId),
      supabase.from('miembro_divisiones').select('usuario_id, area_id, momento').eq('local_id', localId),
      supabase.from('invitaciones').select('*').eq('local_id', localId).order('creado_en'),
    ])
    const divs = (d.data ?? []) as (Division & { usuario_id: string })[]
    setPersonas(
      ((m.data ?? []) as Miembro[])
        .map((p) => ({ ...p, divisiones: divs.filter((x) => x.usuario_id === p.usuario_id).map(({ area_id, momento }) => ({ area_id, momento })) }))
        .sort((a, b) => (a.rol === b.rol ? (a.nombre || a.email || '').localeCompare(b.nombre || b.email || '') : a.rol === 'admin' ? -1 : 1)),
    )
    setInvitaciones((i.data ?? []) as Invitacion[])
  }, [localId])

  useEffect(() => {
    cargar()
  }, [cargar])

  const divisiones = todasLasDivisiones(areas)
  const valido =
    !!draft && (draft.modo === 'editar' || emailValido(draft.email)) && (draft.rol === 'admin' || draft.divisiones.length > 0)
  const yaExiste =
    !!draft &&
    draft.modo === 'invitar' &&
    (personas?.some((p) => p.email?.toLowerCase() === draft.email.trim().toLowerCase()) ||
      invitaciones.some((i) => i.email === draft.email.trim().toLowerCase()))

  const guardar = async () => {
    if (!supabase || !draft || !valido) return
    setBusy(true)
    const divs = draft.rol === 'admin' ? [] : draft.divisiones
    let error: unknown = null
    if (draft.modo === 'invitar') {
      const r = await supabase.from('invitaciones').upsert(
        { local_id: localId, email: draft.email.trim().toLowerCase(), nombre: draft.nombre.trim(), rol: draft.rol, divisiones: divs },
        { onConflict: 'local_id,email' },
      )
      error = r.error
    } else if (draft.usuario_id) {
      const r1 = await supabase.from('miembros').update({ nombre: draft.nombre.trim(), rol: draft.rol }).eq('local_id', localId).eq('usuario_id', draft.usuario_id)
      const r2 = await supabase.from('miembro_divisiones').delete().eq('local_id', localId).eq('usuario_id', draft.usuario_id)
      const r3 = divs.length
        ? await supabase.from('miembro_divisiones').insert(divs.map((d) => ({ ...d, local_id: localId, usuario_id: draft.usuario_id })))
        : { error: null }
      error = r1.error || r2.error || r3.error
    }
    setBusy(false)
    if (error) return toast.show('No se pudo guardar. Probá de nuevo.', { tone: 'error' })
    toast.show(draft.modo === 'invitar' ? `Invitación lista para ${draft.email.trim().toLowerCase()}` : 'Cambios guardados')
    setDraft(null)
    cargar()
  }

  const confirmarQuitar = async () => {
    if (!supabase || !quitar) return
    setBusy(true)
    const { error } =
      quitar.tipo === 'miembro'
        ? await supabase.from('miembros').delete().eq('local_id', localId).eq('usuario_id', quitar.id)
        : await supabase.from('invitaciones').delete().eq('id', quitar.id)
    setBusy(false)
    setQuitar(null)
    if (error) return toast.show('No se pudo quitar. Probá de nuevo.', { tone: 'error' })
    toast.show(quitar.tipo === 'miembro' ? `${quitar.nombre} ya no tiene acceso` : 'Invitación cancelada')
    setDraft(null)
    cargar()
  }

  const mensaje = (inv: Invitacion) =>
    `Hola${inv.nombre ? ` ${inv.nombre.split(' ')[0]}` : ''}! Te sumé a Lineup para ${local?.nombre ?? 'el local'}. Entrá a ${window.location.origin}, tocá "Crear cuenta" y registrate con ${inv.email}.`

  const copiar = async (inv: Invitacion) => {
    try {
      await navigator.clipboard.writeText(mensaje(inv))
      toast.show('Mensaje copiado: pegalo en WhatsApp')
    } catch {
      toast.show('No se pudo copiar', { tone: 'error' })
    }
  }

  const toggleDivision = (d: Division) => {
    if (!draft) return
    const on = draft.divisiones.some((x) => mismaDivision(x, d))
    setDraft({ ...draft, divisiones: on ? draft.divisiones.filter((x) => !mismaDivision(x, d)) : [...draft.divisiones, d] })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0 max-w-xl text-sm text-muted">
          Cada encargado entra con su usuario y confirma las horas de su división. Ve los horarios, el mes y las propinas, pero no los cambia.
        </p>
        <Button variant="primary" onClick={() => setDraft({ modo: 'invitar', email: '', nombre: '', rol: 'encargado', divisiones: [] })} icon={<Plus size={17} />}>
          Invitar encargado
        </Button>
      </div>

      {personas === null ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[68px] rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <ul className="m-0 list-none overflow-hidden rounded-2xl border border-line bg-card p-0 shadow-card">
            {personas.map((p, i) => {
              const yo = p.usuario_id === session?.user.id
              const nombre = p.nombre || p.email || 'Usuario'
              return (
                <li key={p.usuario_id} className={i > 0 ? 'border-t border-divider' : ''}>
                  <button
                    type="button"
                    disabled={yo}
                    onClick={() => setDraft({ modo: 'editar', usuario_id: p.usuario_id, email: p.email ?? '', nombre: p.nombre, rol: p.rol, divisiones: p.divisiones })}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors enabled:hover:bg-hover enabled:active:bg-press disabled:cursor-default"
                  >
                    <Avatar nombre={nombre} size={38} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-semibold">{nombre}</span>
                        {yo && <span className="text-xs text-muted">(vos)</span>}
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        {p.rol === 'admin' ? (
                          <Pill {...pillOk}>
                            <Crown size={11} aria-hidden="true" /> Administrador
                          </Pill>
                        ) : p.divisiones.length ? (
                          p.divisiones.map((d) => (
                            <Pill key={claveDivision(d)} {...pillNeutral}>
                              {nombreDivision(areas, d)}
                            </Pill>
                          ))
                        ) : (
                          <Pill {...pillWarn}>Sin división</Pill>
                        )}
                        {p.nombre && p.email && <span className="truncate text-xs text-muted max-sm:hidden">{p.email}</span>}
                      </span>
                    </span>
                    {!yo && <UserCog size={18} className="text-faint" aria-hidden="true" />}
                  </button>
                </li>
              )
            })}
          </ul>

          {invitaciones.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="m-0 flex items-center gap-2 px-0.5 text-[13px] font-semibold text-muted">
                <Mail size={14} aria-hidden="true" />
                Invitaciones pendientes
              </h3>
              <ul className="m-0 list-none overflow-hidden rounded-2xl border border-line bg-card p-0">
                {invitaciones.map((inv, i) => (
                  <li key={inv.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-divider' : ''}`}>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-[15px] font-medium">{inv.nombre || inv.email}</span>
                      <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        {inv.nombre && <span className="truncate">{inv.email}</span>}
                        {inv.rol === 'admin' ? (
                          <Pill {...pillOk}>Administrador</Pill>
                        ) : (
                          inv.divisiones.map((d) => (
                            <Pill key={claveDivision(d)} {...pillNeutral}>
                              {nombreDivision(areas, d)}
                            </Pill>
                          ))
                        )}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Button size="sm" onClick={() => copiar(inv)} icon={<Copy size={15} />}>
                        Copiar mensaje
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setQuitar({ tipo: 'invitacion', id: inv.id, nombre: inv.email })}
                        className="text-danger hover:bg-danger-soft hover:text-danger"
                      >
                        Cancelar
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="m-0 px-0.5 text-xs text-muted">
                Cuando creen su cuenta con ese email y la confirmen, entran directo a {local?.nombre ?? 'tu local'}.
              </p>
            </section>
          )}
        </>
      )}

      <Sheet
        open={!!draft}
        title={draft?.modo === 'editar' ? draft.nombre || draft.email : 'Invitar encargado'}
        subtitle={draft?.modo === 'editar' ? draft.email : 'Le llega acceso apenas cree su cuenta'}
        onClose={() => setDraft(null)}
        footer={
          <>
            {draft?.modo === 'editar' && draft.usuario_id && (
              <Button
                variant="ghost"
                onClick={() => setQuitar({ tipo: 'miembro', id: draft.usuario_id!, nombre: draft.nombre || draft.email })}
                icon={<Trash2 size={16} />}
                className="text-danger hover:bg-danger-soft hover:text-danger"
              >
                Quitar acceso
              </Button>
            )}
            <span className="flex-1" />
            <Button onClick={() => setDraft(null)}>Cancelar</Button>
            <Button variant="primary" onClick={guardar} disabled={!valido} loading={busy}>
              {draft?.modo === 'editar' ? 'Guardar cambios' : 'Crear invitación'}
            </Button>
          </>
        }
      >
        {draft && (
          <>
            <Field label="Nombre">
              {(id) => <TextInput id={id} value={draft.nombre} placeholder="Ej.: Pablo" onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} />}
            </Field>
            {draft.modo === 'invitar' && (
              <Field label="Email" hint="Con este email va a crear su cuenta." error={yaExiste ? 'Ese email ya tiene acceso o una invitación: al guardar se actualiza.' : null}>
                {(id) => (
                  <TextInput
                    id={id}
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    value={draft.email}
                    placeholder="nombre@email.com"
                    onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  />
                )}
              </Field>
            )}
            <Field label="Rol">
              {() => (
                <Segmented
                  label="Rol"
                  value={draft.rol}
                  onChange={(rol) => setDraft({ ...draft, rol })}
                  options={[
                    { value: 'encargado', label: 'Encargado', icon: <ShieldCheck size={15} /> },
                    { value: 'admin', label: 'Administrador', icon: <Crown size={15} /> },
                  ]}
                />
              )}
            </Field>
            {draft.rol === 'admin' ? (
              <Notice tone="info">Un administrador puede hacer todo: armar horarios, configurar, cargar y pagar propinas, e invitar a otros.</Notice>
            ) : (
              <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                <legend className="mb-2 p-0 text-[13px] font-medium text-ink-2">Confirma las horas de</legend>
                <div className="grid grid-cols-2 gap-2">
                  {divisiones.map((d) => {
                    const on = draft.divisiones.some((x) => mismaDivision(x, d))
                    return (
                      <label
                        key={claveDivision(d)}
                        className={`flex h-12 cursor-pointer items-center gap-2.5 rounded-xl border px-3 text-sm font-medium transition-colors ${
                          on ? 'border-olive bg-olive-soft text-ink' : 'border-line bg-card text-ink-2 hover:border-line-strong hover:bg-hover'
                        }`}
                      >
                        <input type="checkbox" checked={on} onChange={() => toggleDivision(d)} className="sr-only" />
                        <span
                          aria-hidden="true"
                          className={`flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors ${on ? 'border-olive bg-olive text-white' : 'border-line-strong bg-card'}`}
                        >
                          {on && <Check size={13} strokeWidth={3} />}
                        </span>
                        {nombreDivision(areas, d)}
                      </label>
                    )
                  })}
                </div>
                <span className="text-xs text-muted">Puede tener más de una, por ejemplo si cubre salón de día y de noche.</span>
              </fieldset>
            )}
          </>
        )}
      </Sheet>

      <ConfirmDialog
        open={!!quitar}
        title={quitar?.tipo === 'miembro' ? `¿Quitarle el acceso a ${quitar.nombre}?` : '¿Cancelar la invitación?'}
        message={
          quitar?.tipo === 'miembro'
            ? 'Ya no va a poder entrar a este local. Las horas que confirmó quedan registradas.'
            : 'Si ya creó la cuenta, no va a poder entrar a este local.'
        }
        confirmLabel={quitar?.tipo === 'miembro' ? 'Quitar acceso' : 'Cancelar invitación'}
        danger
        busy={busy}
        onConfirm={confirmarQuitar}
        onCancel={() => setQuitar(null)}
      />
    </div>
  )
}
