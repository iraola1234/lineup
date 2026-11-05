import { useMemo, useState } from 'react'
import { Button, Field, Notice, Pill, Sheet, TextInput, Toggle, inputCls, pillDanger, pillNeutral, pillOk } from '../../components/ui'
import { useLocalId } from '../../lib/local'
import { supabase } from '../../lib/supabase'
import type { Area, Empleado } from '../../lib/types'
import { FK_VIOLATION, useTabla } from '../../lib/useTabla'

type Draft = {
  id?: string
  nombre: string
  area_id: string
  puesto: string
  horas: string
  participa_propina: boolean
  activo: boolean
}

export function EmpleadosTab() {
  const localId = useLocalId()
  const areas = useTabla<Area>('areas', localId, [{ col: 'orden' }, { col: 'nombre' }])
  const emps = useTabla<Empleado>('empleados', localId, [{ col: 'orden' }, { col: 'nombre' }])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [verInactivos, setVerInactivos] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const areaNombre = useMemo(() => new Map(areas.rows.map((a) => [a.id, a.nombre])), [areas.rows])
  const activos = emps.rows.filter((e) => e.activo)
  const inactivos = emps.rows.filter((e) => !e.activo)
  const visibles = verInactivos ? emps.rows : activos

  const nuevo = () =>
    setDraft({
      nombre: '',
      area_id: areas.rows[0]?.id ?? '',
      puesto: '',
      horas: '48',
      participa_propina: true,
      activo: true,
    })

  const editar = (e: Empleado) =>
    setDraft({
      id: e.id,
      nombre: e.nombre,
      area_id: e.area_id,
      puesto: e.puesto,
      horas: String(e.horas_contrato_semana),
      participa_propina: e.participa_propina,
      activo: e.activo,
    })

  const horasNum = draft ? Number(draft.horas.replace(',', '.')) : 0
  const valido = !!draft && draft.nombre.trim() !== '' && draft.area_id !== '' && horasNum >= 0 && horasNum <= 80

  const guardar = async () => {
    if (!supabase || !draft || !valido) return
    setBusy(true)
    const fila = {
      local_id: localId,
      nombre: draft.nombre.trim(),
      area_id: draft.area_id,
      puesto: draft.puesto.trim(),
      horas_contrato_semana: horasNum,
      participa_propina: draft.participa_propina,
      activo: draft.activo,
    }
    const { error } = draft.id
      ? await supabase.from('empleados').update(fila).eq('id', draft.id)
      : await supabase.from('empleados').insert(fila)
    setBusy(false)
    if (error) return setMsg({ tone: 'error', text: 'No se pudo guardar. Probá de nuevo.' })
    setMsg({ tone: 'ok', text: draft.id ? `Se guardaron los cambios de ${fila.nombre}.` : `${fila.nombre} se sumó al equipo.` })
    setDraft(null)
    emps.reload()
  }

  /** Si tiene turnos en el historial no se borra: se da de baja para conservar horas y propinas. */
  const eliminar = async () => {
    if (!supabase || !draft?.id) return
    setBusy(true)
    const { error } = await supabase.from('empleados').delete().eq('id', draft.id)
    if (error?.code === FK_VIOLATION) {
      await supabase.from('empleados').update({ activo: false }).eq('id', draft.id)
      setMsg({ tone: 'ok', text: `${draft.nombre} tiene turnos en el historial, así que se dio de baja en lugar de borrarse.` })
    } else if (error) {
      setMsg({ tone: 'error', text: 'No se pudo eliminar. Probá de nuevo.' })
    } else {
      setMsg({ tone: 'ok', text: `${draft.nombre} se eliminó.` })
    }
    setBusy(false)
    setDraft(null)
    emps.reload()
  }

  if (emps.loading || areas.loading) return <p className="text-sm text-muted">Cargando…</p>
  if (emps.error || areas.error) return <Notice tone="error">{emps.error ?? areas.error}</Notice>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-sm text-muted">
          <span className="font-mono text-ink">{activos.length}</span> activos
          {inactivos.length > 0 && (
            <>
              {' · '}
              <button
                type="button"
                onClick={() => setVerInactivos((v) => !v)}
                className="font-medium text-olive underline underline-offset-4"
              >
                {verInactivos ? 'ocultar' : 'ver'} {inactivos.length} {inactivos.length === 1 ? 'dado' : 'dados'} de baja
              </button>
            </>
          )}
        </p>
        <Button variant="primary" onClick={nuevo} disabled={areas.rows.length === 0}>
          <span aria-hidden="true" className="text-lg leading-none">+</span> Nuevo empleado
        </Button>
      </div>

      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      {emps.rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-card p-6 text-center text-sm text-muted">
          Todavía no hay empleados. Empezá con <span className="font-semibold text-ink">Nuevo empleado</span>.
        </div>
      ) : (
        <>
          {/* Celular: lista agrupada por área */}
          <div className="flex flex-col gap-4 lg:hidden">
            {areas.rows.map((area) => {
              const lista = visibles.filter((e) => e.area_id === area.id)
              if (lista.length === 0) return null
              return (
                <section key={area.id} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between px-0.5">
                    <h3 className="m-0 text-[13px] font-semibold text-muted">{area.nombre}</h3>
                    <span className="font-mono text-xs text-muted">{lista.length}</span>
                  </div>
                  <ul className="m-0 list-none overflow-hidden rounded-2xl border border-line bg-card p-0">
                    {lista.map((e, i) => (
                      <li key={e.id} className={i > 0 ? 'border-t border-divider' : ''}>
                        <button
                          type="button"
                          onClick={() => editar(e)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left"
                        >
                          <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className={`truncate text-[15px] font-semibold ${e.activo ? '' : 'text-muted line-through'}`}>
                              {e.nombre}
                            </span>
                            <span className="flex flex-wrap items-center gap-1.5">
                              {e.puesto && <span className="text-xs text-muted">{e.puesto}</span>}
                              <Pill {...pillNeutral} mono>
                                {e.horas_contrato_semana} h/sem
                              </Pill>
                              {!e.participa_propina && <Pill {...pillNeutral}>Sin propina</Pill>}
                              {!e.activo && <Pill {...pillDanger}>De baja</Pill>}
                            </span>
                          </span>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted" aria-hidden="true">
                            <path d="M9 6l6 6-6 6" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>

          {/* Computadora: tabla */}
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-card lg:block">
            <table className="w-full border-collapse text-left text-[15px]">
              <thead className="bg-head text-[13px] text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Nombre</th>
                  <th className="px-5 py-3 font-medium">Área</th>
                  <th className="px-5 py-3 font-medium">Puesto</th>
                  <th className="px-5 py-3 text-right font-medium">Contrato</th>
                  <th className="px-5 py-3 font-medium">Propina</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((e) => (
                  <tr key={e.id} className="border-t border-line hover:bg-head/60">
                    <td className="px-5 py-3.5 font-medium">{e.nombre}</td>
                    <td className="px-5 py-3.5 text-muted">{areaNombre.get(e.area_id)}</td>
                    <td className="px-5 py-3.5 text-muted">{e.puesto || '—'}</td>
                    <td className="px-5 py-3.5 text-right font-mono">{e.horas_contrato_semana} h</td>
                    <td className="px-5 py-3.5">
                      {e.participa_propina ? <Pill {...pillOk}>Participa</Pill> : <Pill {...pillNeutral}>No</Pill>}
                    </td>
                    <td className="px-5 py-3.5">
                      {e.activo ? <Pill {...pillOk}>Activo</Pill> : <Pill {...pillDanger}>De baja</Pill>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button onClick={() => editar(e)} className="h-9">
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Sheet
        open={!!draft}
        title={draft?.id ? 'Editar empleado' : 'Nuevo empleado'}
        onClose={() => setDraft(null)}
        footer={
          <>
            {draft?.id && (
              <Button variant="danger" onClick={eliminar} disabled={busy}>
                Eliminar
              </Button>
            )}
            <span className="flex-1" />
            <Button onClick={() => setDraft(null)}>Cancelar</Button>
            <Button variant="primary" onClick={guardar} disabled={!valido || busy}>
              {busy ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        {draft && (
          <>
            <Field label="Nombre">
              {(id) => (
                <TextInput id={id} value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} />
              )}
            </Field>
            <Field label="Área">
              {(id) => (
                <select
                  id={id}
                  value={draft.area_id}
                  onChange={(e) => setDraft({ ...draft, area_id: e.target.value })}
                  className={inputCls}
                >
                  {areas.rows.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Puesto" hint="Ej.: Mozo, Barra, Cocinero, Bacha">
              {(id) => (
                <TextInput id={id} value={draft.puesto} onChange={(e) => setDraft({ ...draft, puesto: e.target.value })} />
              )}
            </Field>
            <Field label="Horas semanales de contrato" hint="Solo se usa para avisar si se pasa; nunca bloquea.">
              {(id) => (
                <TextInput
                  id={id}
                  inputMode="decimal"
                  value={draft.horas}
                  onChange={(e) => setDraft({ ...draft, horas: e.target.value })}
                  className="font-mono"
                />
              )}
            </Field>
            <div className="flex flex-col divide-y divide-divider rounded-xl border border-line px-4">
              <Toggle
                label="Participa de las propinas"
                checked={draft.participa_propina}
                onChange={(v) => setDraft({ ...draft, participa_propina: v })}
              />
              {draft.id && (
                <Toggle
                  label="Activo"
                  description="Los dados de baja no aparecen para asignar turnos."
                  checked={draft.activo}
                  onChange={(v) => setDraft({ ...draft, activo: v })}
                />
              )}
            </div>
            {draft.id && (
              <p className="m-0 text-xs text-muted">
                Si tiene turnos en el historial, “Eliminar” lo da de baja para no perder sus horas ni propinas.
              </p>
            )}
          </>
        )}
      </Sheet>
    </div>
  )
}
