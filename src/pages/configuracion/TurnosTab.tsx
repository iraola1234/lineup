import { useState } from 'react'
import { Button, Field, Notice, Pill, Sheet, TextInput, pillNeutral } from '../../components/ui'
import { COLOR_KEYS, TURNO_COLORS, turnoColor } from '../../lib/colors'
import { useLocalId } from '../../lib/local'
import { supabase } from '../../lib/supabase'
import { duracion, fmtHoras, hhmm } from '../../lib/time'
import type { TipoTurno } from '../../lib/types'
import { useTabla } from '../../lib/useTabla'

type Draft = { id?: string; nombre: string; inicio: string; fin: string; color: string }

export function TurnosTab() {
  const localId = useLocalId()
  const turnos = useTabla<TipoTurno>('tipos_turno', localId, [{ col: 'orden' }, { col: 'inicio' }])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const activos = turnos.rows.filter((t) => !t.archivado)
  const archivados = turnos.rows.filter((t) => t.archivado)

  const valido = !!draft && draft.nombre.trim() !== '' && draft.inicio !== '' && draft.fin !== '' && draft.inicio !== draft.fin

  const guardar = async () => {
    if (!supabase || !draft || !valido) return
    setBusy(true)
    const fila = {
      local_id: localId,
      nombre: draft.nombre.trim(),
      inicio: draft.inicio,
      fin: draft.fin,
      color: draft.color,
      ...(draft.id ? {} : { orden: turnos.rows.length + 1 }),
    }
    const { error } = draft.id
      ? await supabase.from('tipos_turno').update(fila).eq('id', draft.id)
      : await supabase.from('tipos_turno').insert(fila)
    setBusy(false)
    if (error) return setMsg({ tone: 'error', text: 'No se pudo guardar. Probá de nuevo.' })
    setMsg({ tone: 'ok', text: draft.id ? `Se actualizó ${fila.nombre}.` : `Se creó el turno ${fila.nombre}.` })
    setDraft(null)
    turnos.reload()
  }

  /** Si el turno ya se usó, se archiva (el historial guarda su propia copia del horario). */
  const eliminar = async () => {
    if (!supabase || !draft?.id) return
    setBusy(true)
    const { count } = await supabase
      .from('asignaciones')
      .select('id', { count: 'exact', head: true })
      .eq('tipo_turno_id', draft.id)
    if ((count ?? 0) > 0) {
      await supabase.from('tipos_turno').update({ archivado: true }).eq('id', draft.id)
      setMsg({ tone: 'ok', text: `${draft.nombre} ya se usó, así que se archivó: no aparece para asignar, pero el historial queda igual.` })
    } else {
      const { error } = await supabase.from('tipos_turno').delete().eq('id', draft.id)
      setMsg(error ? { tone: 'error', text: 'No se pudo eliminar.' } : { tone: 'ok', text: `Se eliminó ${draft.nombre}.` })
    }
    setBusy(false)
    setDraft(null)
    turnos.reload()
  }

  const restaurar = async (t: TipoTurno) => {
    if (!supabase) return
    await supabase.from('tipos_turno').update({ archivado: false }).eq('id', t.id)
    setMsg({ tone: 'ok', text: `${t.nombre} vuelve a estar disponible.` })
    turnos.reload()
  }

  if (turnos.loading) return <p className="text-sm text-muted">Cargando…</p>
  if (turnos.error) return <Notice tone="error">{turnos.error}</Notice>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 max-w-xl text-sm text-muted">
          Son las opciones para asignar. El turno <span className="font-semibold text-ink">Otro</span> (horario a mano) siempre está
          disponible.
        </p>
        <Button
          variant="primary"
          onClick={() => setDraft({ nombre: '', inicio: '09:00', fin: '17:00', color: 'azul' })}
        >
          <span aria-hidden="true" className="text-lg leading-none">+</span> Nuevo turno
        </Button>
      </div>

      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
        {activos.map((t) => {
          const c = turnoColor(t.color)
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setDraft({ id: t.id, nombre: t.nombre, inicio: hhmm(t.inicio), fin: hhmm(t.fin), color: t.color })}
                className="flex w-full items-center gap-4 rounded-2xl border border-line bg-card p-4 text-left hover:bg-head/60"
              >
                <span
                  aria-hidden="true"
                  className="flex h-12 w-14 shrink-0 items-center justify-center rounded-xl border font-mono text-xs font-semibold"
                  style={{ background: c.bg, color: c.fg, borderColor: c.bd }}
                >
                  {t.nombre.charAt(0).toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-[15px] font-semibold">{t.nombre}</span>
                  <span className="font-mono text-sm text-muted">
                    {hhmm(t.inicio)} – {hhmm(t.fin)} · {fmtHoras(duracion(t.inicio, t.fin))}
                  </span>
                </span>
                <span className="text-sm font-medium text-olive">Editar</span>
              </button>
            </li>
          )
        })}
      </ul>

      {archivados.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="m-0 px-0.5 text-[13px] font-semibold text-muted">Archivados</h3>
          <ul className="m-0 list-none overflow-hidden rounded-2xl border border-line bg-card p-0">
            {archivados.map((t, i) => (
              <li key={t.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-divider' : ''}`}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] font-medium text-muted">{t.nombre}</span>
                  <span className="font-mono text-xs text-muted">
                    {hhmm(t.inicio)} – {hhmm(t.fin)}
                  </span>
                </span>
                <Pill {...pillNeutral}>Archivado</Pill>
                <Button className="h-9" onClick={() => restaurar(t)}>
                  Restaurar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Sheet
        open={!!draft}
        title={draft?.id ? 'Editar turno' : 'Nuevo turno'}
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
            <Field label="Nombre" hint="Ej.: Mañana, Madrugada, Refuerzo">
              {(id) => (
                <TextInput id={id} value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} />
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Entrada">
                {(id) => (
                  <TextInput
                    id={id}
                    type="time"
                    step={900}
                    value={draft.inicio}
                    onChange={(e) => setDraft({ ...draft, inicio: e.target.value })}
                    className="font-mono"
                  />
                )}
              </Field>
              <Field label="Salida">
                {(id) => (
                  <TextInput
                    id={id}
                    type="time"
                    step={900}
                    value={draft.fin}
                    onChange={(e) => setDraft({ ...draft, fin: e.target.value })}
                    className="font-mono"
                  />
                )}
              </Field>
            </div>
            {draft.inicio && draft.fin && draft.inicio !== draft.fin && (
              <p className="m-0 -mt-2 text-sm text-muted">
                Duración: <span className="font-mono text-ink">{fmtHoras(duracion(draft.inicio, draft.fin))}</span>
                {draft.fin < draft.inicio && ' · termina al día siguiente, cuenta como el día en que empieza'}
              </p>
            )}
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-1.5 p-0 text-sm font-medium text-muted">Color</legend>
              <div className="flex flex-wrap gap-2">
                {COLOR_KEYS.map((k) => {
                  const c = TURNO_COLORS[k]
                  const on = draft.color === k
                  return (
                    <label
                      key={k}
                      className={`flex h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-medium ${
                        on ? 'border-olive ring-2 ring-olive/30' : 'border-line'
                      }`}
                    >
                      <input
                        type="radio"
                        name="color"
                        value={k}
                        checked={on}
                        onChange={() => setDraft({ ...draft, color: k })}
                        className="sr-only"
                      />
                      <span aria-hidden="true" className="size-5 rounded-md border" style={{ background: c.bg, borderColor: c.bd }} />
                      {c.label}
                    </label>
                  )
                })}
              </div>
            </fieldset>
            {draft.id && (
              <p className="m-0 rounded-xl bg-head px-3 py-2.5 text-xs text-muted">
                Los cambios aplican a los turnos que asignes de ahora en adelante. Lo ya asignado conserva su horario.
              </p>
            )}
          </>
        )}
      </Sheet>
    </div>
  )
}
