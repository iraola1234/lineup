import { BadgeCheck, Check, Copy, Crown, Eye, EyeOff, KeyRound, Mail, Plus, ShieldCheck, Trash2, UserCog, Wand2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useToast } from '../../components/toast'
import {
  Avatar,
  Button,
  ConfirmDialog,
  Field,
  Notice,
  Pill,
  Segmented,
  Select,
  Sheet,
  Skeleton,
  TextInput,
  pillNeutral,
  pillOk,
  pillWarn,
} from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { useData } from '../../lib/data'
import { claveDivision, mismaDivision, nombreDivision, todasLasDivisiones } from '../../lib/divisiones'
import { useLocal, useLocalId } from '../../lib/local'
import { supabase } from '../../lib/supabase'
import type { Division, Invitacion, Miembro, Rol } from '../../lib/types'

type Persona = Miembro & { divisiones: Division[] }
type Draft = {
  modo: 'crear' | 'editar'
  usuario_id?: string
  email: string
  nombre: string
  rol: Rol
  divisiones: Division[]
  empleado_id: string | null
  yo?: boolean
  /** Contraseña inicial (crear) o nueva (restablecer). */
  password: string
  restablecer?: boolean
}

/** Datos para pasarle a la persona (se muestran una sola vez). */
type Acceso = { nombre: string; email: string; password: string; nuevo: boolean }

/** Contraseña fácil de dictar: sin letras que se confunden (l, 1, O, 0). */
function generarContrasena() {
  const letras = 'abcdefghjkmnpqrstuvwxyz'
  const numeros = '23456789'
  const al = (s: string) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length]
  const parte = () => Array.from({ length: 4 }, () => al(letras)).join('')
  return `${parte()}-${parte()}-${al(numeros)}${al(numeros)}`
}

/** Llama a la función de servidor que administra cuentas. Devuelve el mensaje de error, si hubo. */
async function invocarUsuarios(body: Record<string, unknown>): Promise<string | null> {
  if (!supabase) return 'Sin conexión a la base de datos.'
  const { error } = await supabase.functions.invoke('usuarios', { body })
  if (!error) return null
  try {
    const ctx = (error as { context?: Response }).context
    const j = ctx ? await ctx.json() : null
    if (j?.error) return String(j.error)
  } catch {
    // respuesta sin cuerpo
  }
  return 'No se pudo completar. Revisá la conexión y probá de nuevo.'
}

const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())

export function UsuariosTab() {
  const localId = useLocalId()
  const { local, recargar: recargarLocal } = useLocal()
  const { session } = useAuth()
  const { areas, empleados } = useData()
  const toast = useToast()
  const [personas, setPersonas] = useState<Persona[] | null>(null)
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [acceso, setAcceso] = useState<Acceso | null>(null)
  const [verClave, setVerClave] = useState(false)
  const [quitar, setQuitar] = useState<{
    tipo: 'miembro' | 'invitacion'
    id: string
    nombre: string
  } | null>(null)

  const cargar = useCallback(async () => {
    if (!supabase) return
    const [m, d, i] = await Promise.all([
      supabase.from('miembros').select('usuario_id, local_id, rol, email, nombre, empleado_id').eq('local_id', localId),
      supabase.from('miembro_divisiones').select('usuario_id, area_id, momento').eq('local_id', localId),
      supabase.from('invitaciones').select('*').eq('local_id', localId).order('creado_en'),
    ])
    const divs = (d.data ?? []) as (Division & { usuario_id: string })[]
    setPersonas(
      ((m.data ?? []) as Miembro[])
        .map((p) => ({
          ...p,
          divisiones: divs.filter((x) => x.usuario_id === p.usuario_id).map(({ area_id, momento }) => ({ area_id, momento })),
        }))
        .sort((a, b) => (a.rol === b.rol ? (a.nombre || a.email || '').localeCompare(b.nombre || b.email || '') : a.rol === 'admin' ? -1 : 1)),
    )
    setInvitaciones((i.data ?? []) as Invitacion[])
  }, [localId])

  useEffect(() => {
    cargar()
  }, [cargar])

  const divisiones = todasLasDivisiones(areas)
  const empleadoNombre = (id: string) => empleados.find((e) => e.id === id)?.nombre
  // Fichas que ya usa otro usuario (o una invitación) no se ofrecen
  const ocupadas = new Set([
    ...(personas ?? []).filter((p) => p.usuario_id !== draft?.usuario_id).map((p) => p.empleado_id),
    ...invitaciones.filter((i) => i.email !== draft?.email.trim().toLowerCase()).map((i) => i.empleado_id),
  ])
  const fichas = empleados.filter((e) => (e.activo || e.id === draft?.empleado_id) && (!ocupadas.has(e.id) || e.id === draft?.empleado_id))
  const claveOk = (c: string) => c.length >= 8
  const valido =
    !!draft &&
    (draft.modo === 'editar' || (emailValido(draft.email) && claveOk(draft.password))) &&
    (!draft.restablecer || claveOk(draft.password)) &&
    (draft.yo || draft.rol === 'admin' || draft.divisiones.length > 0)
  const yaExiste =
    !!draft && draft.modo === 'crear' && !!personas?.some((p) => p.email?.toLowerCase() === draft.email.trim().toLowerCase())

  const guardar = async () => {
    if (!supabase || !draft || !valido) return
    setBusy(true)
    const divs = draft.rol === 'admin' ? [] : draft.divisiones
    const empleado_id = draft.empleado_id || null
    let error: unknown = null
    if (draft.modo === 'crear') {
      const email = draft.email.trim().toLowerCase()
      const msg = await invocarUsuarios({
        accion: 'crear',
        local_id: localId,
        email,
        password: draft.password,
        nombre: draft.nombre.trim(),
        rol: draft.rol,
        divisiones: divs,
        empleado_id,
      })
      setBusy(false)
      if (msg) return toast.show(msg, { tone: 'error' })
      setDraft(null)
      setVerClave(false)
      setAcceso({ nombre: draft.nombre.trim(), email, password: draft.password, nuevo: true })
      return cargar()
    }
    if (draft.usuario_id && draft.restablecer) {
      const msg = await invocarUsuarios({ accion: 'contrasena', local_id: localId, usuario_id: draft.usuario_id, password: draft.password })
      if (msg) {
        setBusy(false)
        return toast.show(msg, { tone: 'error' })
      }
    }
    if (draft.usuario_id) {
      // A uno mismo no se le cambia el rol (no podés sacarte de administrador)
      const cambios = draft.yo ? { nombre: draft.nombre.trim(), empleado_id } : { nombre: draft.nombre.trim(), rol: draft.rol, empleado_id }
      const r1 = await supabase.from('miembros').update(cambios).eq('local_id', localId).eq('usuario_id', draft.usuario_id)
      if (draft.yo) {
        setBusy(false)
        if (r1.error)
          return toast.show(r1.error.code === '23505' ? 'Esa ficha ya está vinculada a otro usuario.' : 'No se pudo guardar. Probá de nuevo.', {
            tone: 'error',
          })
        toast.show('Cambios guardados')
        setDraft(null)
        recargarLocal()
        return cargar()
      }
      const r2 = await supabase.from('miembro_divisiones').delete().eq('local_id', localId).eq('usuario_id', draft.usuario_id)
      const r3 = divs.length
        ? await supabase.from('miembro_divisiones').insert(
            divs.map((d) => ({
              ...d,
              local_id: localId,
              usuario_id: draft.usuario_id,
            })),
          )
        : { error: null }
      error = r1.error || r2.error || r3.error
    }
    setBusy(false)
    if (error)
      return toast.show((error as { code?: string }).code === '23505' ? 'Esa ficha ya está vinculada a otro usuario.' : 'No se pudo guardar. Probá de nuevo.', {
        tone: 'error',
      })
    setDraft(null)
    if (draft.restablecer) setAcceso({ nombre: draft.nombre, email: draft.email, password: draft.password, nuevo: false })
    else toast.show('Cambios guardados')
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
    if (error)
      return toast.show('No se pudo quitar. Probá de nuevo.', {
        tone: 'error',
      })
    toast.show(quitar.tipo === 'miembro' ? `${quitar.nombre} ya no tiene acceso` : 'Invitación cancelada')
    setDraft(null)
    cargar()
  }

  const mensajeAcceso = (a: Acceso) =>
    `Hola${a.nombre ? ` ${a.nombre.split(' ')[0]}` : ''}! ${a.nuevo ? `Te creé un usuario en el backoffice de ${local?.nombre ?? 'Mansalva'}` : 'Te cambié la contraseña del backoffice'}.\n\nEntrá a: ${window.location.origin}\nEmail: ${a.email}\nContraseña: ${a.password}\n\nDespués podés cambiarla desde tu cuenta.`

  const copiarAcceso = async (a: Acceso) => {
    try {
      await navigator.clipboard.writeText(mensajeAcceso(a))
      toast.show('Datos copiados: pegalos en WhatsApp')
    } catch {
      toast.show('No se pudo copiar', { tone: 'error' })
    }
  }

  const mensaje = (inv: Invitacion) =>
    `Hola${inv.nombre ? ` ${inv.nombre.split(' ')[0]}` : ''}! Te di acceso al backoffice de ${local?.nombre ?? 'Mansalva'}. Entrá a ${window.location.origin} con ${inv.email}.`

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
    setDraft({
      ...draft,
      divisiones: on ? draft.divisiones.filter((x) => !mismaDivision(x, d)) : [...draft.divisiones, d],
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0 max-w-xl text-sm text-muted">
          Cada usuario entra con su email y contraseña. Los administradores manejan todo; los encargados ven todo y confirman las horas de su división.
        </p>
        <Button
          variant="primary"
          onClick={() =>
            setDraft({
              modo: 'crear',
              email: '',
              nombre: '',
              rol: 'encargado',
              divisiones: [],
              empleado_id: null,
              password: generarContrasena(),
            })
          }
          icon={<Plus size={17} />}
        >
          Nuevo usuario
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
                    onClick={() =>
                      setDraft({
                        modo: 'editar',
                        usuario_id: p.usuario_id,
                        email: p.email ?? '',
                        nombre: p.nombre,
                        rol: p.rol,
                        divisiones: p.divisiones,
                        empleado_id: p.empleado_id,
                        yo,
                        password: '',
                      })
                    }
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-hover active:bg-press"
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
                        {p.empleado_id && empleadoNombre(p.empleado_id) && (
                          <Pill {...pillNeutral}>
                            <BadgeCheck size={11} aria-hidden="true" /> Empleado: {empleadoNombre(p.empleado_id)}
                          </Pill>
                        )}
                        {p.nombre && p.email && <span className="truncate text-xs text-muted max-sm:hidden">{p.email}</span>}
                      </span>
                    </span>
                    <UserCog size={18} className="text-faint" aria-hidden="true" />
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
                        onClick={() =>
                          setQuitar({
                            tipo: 'invitacion',
                            id: inv.id,
                            nombre: inv.email,
                          })
                        }
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
        title={draft?.modo === 'editar' ? draft.nombre || draft.email : 'Nuevo usuario'}
        subtitle={draft?.modo === 'editar' ? draft.email : 'La cuenta queda lista para entrar, sin confirmar email'}
        onClose={() => setDraft(null)}
        footer={
          <>
            {draft?.modo === 'editar' && draft.usuario_id && !draft.yo && (
              <Button
                variant="ghost"
                onClick={() =>
                  setQuitar({
                    tipo: 'miembro',
                    id: draft.usuario_id!,
                    nombre: draft.nombre || draft.email,
                  })
                }
                icon={<Trash2 size={16} />}
                className="text-danger hover:bg-danger-soft hover:text-danger"
              >
                Quitar acceso
              </Button>
            )}
            <span className="flex-1" />
            <Button onClick={() => setDraft(null)}>Cancelar</Button>
            <Button variant="primary" onClick={guardar} disabled={!valido} loading={busy}>
              {draft?.modo === 'editar' ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </>
        }
      >
        {draft && (
          <>
            <Field label="Nombre">
              {(id) => <TextInput id={id} value={draft.nombre} placeholder="Ej.: Pablo" onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} />}
            </Field>
            {draft.modo === 'crear' && (
              <Field label="Email" hint="Con este email va a entrar." error={yaExiste ? 'Ese email ya tiene un usuario en este local.' : null}>
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
            {(draft.modo === 'crear' || draft.restablecer) && (
              <Field
                label={draft.modo === 'crear' ? 'Contraseña inicial' : 'Nueva contraseña'}
                hint="Mínimo 8 caracteres. Se la pasás vos; después la puede cambiar desde su cuenta."
                error={draft.password && !claveOk(draft.password) ? 'Tiene que tener al menos 8 caracteres.' : null}
              >
                {(id) => (
                  <div className="flex gap-2">
                    <div className="relative min-w-0 flex-1">
                      <TextInput
                        id={id}
                        type={verClave ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={draft.password}
                        onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                        className="pr-12 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setVerClave((v) => !v)}
                        aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        className="absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-ink"
                      >
                        {verClave ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <Button
                      onClick={() => {
                        setDraft({ ...draft, password: generarContrasena() })
                        setVerClave(true)
                      }}
                      icon={<Wand2 size={16} />}
                    >
                      Generar
                    </Button>
                  </div>
                )}
              </Field>
            )}
            {draft.modo === 'editar' && !draft.yo && !draft.restablecer && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-head px-3.5 py-3">
                <span className="text-[13px] text-ink-2">¿Se olvidó la contraseña?</span>
                <Button
                  size="sm"
                  onClick={() => {
                    setDraft({ ...draft, restablecer: true, password: generarContrasena() })
                    setVerClave(true)
                  }}
                  icon={<KeyRound size={15} />}
                >
                  Restablecer contraseña
                </Button>
              </div>
            )}
            {draft.yo && <p className="m-0 -mt-1 text-xs text-muted">Tu contraseña la cambiás desde el menú de tu cuenta.</p>}
            <Field label="También es empleado" hint="Si trabaja en el local, elegí su ficha: así figura en horarios, horas y propinas como cualquier empleado.">
              {(id) => (
                <Select id={id} value={draft.empleado_id ?? ''} onChange={(e) => setDraft({ ...draft, empleado_id: e.target.value || null })}>
                  <option value="">No, solo gestiona</option>
                  {fichas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                      {e.puesto ? ` · ${e.puesto}` : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {draft.yo ? (
              <Notice tone="info">Sos administrador: podés armar horarios, confirmar cualquier división, cargar y pagar propinas e invitar a otros.</Notice>
            ) : (
              <>
                <Field label="Rol">
                  {() => (
                    <Segmented
                      label="Rol"
                      value={draft.rol}
                      onChange={(rol) => setDraft({ ...draft, rol })}
                      options={[
                        {
                          value: 'encargado',
                          label: 'Encargado',
                          icon: <ShieldCheck size={15} />,
                        },
                        {
                          value: 'admin',
                          label: 'Administrador',
                          icon: <Crown size={15} />,
                        },
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
          </>
        )}
      </Sheet>

      <Sheet
        open={!!acceso}
        title={acceso?.nuevo ? 'Usuario creado' : 'Contraseña cambiada'}
        subtitle="Pasale estos datos para entrar"
        onClose={() => setAcceso(null)}
        footer={
          <>
            <span className="flex-1" />
            <Button onClick={() => setAcceso(null)}>Listo</Button>
            <Button variant="primary" onClick={() => acceso && copiarAcceso(acceso)} icon={<Copy size={16} />}>
              Copiar datos
            </Button>
          </>
        }
      >
        {acceso && (
          <div className="flex flex-col gap-3">
            <dl className="m-0 flex flex-col overflow-hidden rounded-2xl border border-line">
              {[
                ['Dirección', window.location.origin],
                ['Email', acceso.email],
                ['Contraseña', acceso.password],
              ].map(([k, v], i) => (
                <div key={k} className={`flex items-center justify-between gap-3 px-4 py-3 ${i > 0 ? 'border-t border-divider' : ''}`}>
                  <dt className="text-[13px] text-muted">{k}</dt>
                  <dd className="m-0 truncate font-mono text-[14px] font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <Notice tone="info">Por seguridad, la contraseña no se vuelve a mostrar. Copiala ahora; si se pierde, la podés restablecer.</Notice>
          </div>
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
