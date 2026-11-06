import { Archive, ArchiveRestore, Clock, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '../../components/toast'
import { Button, ConfirmDialog, Field, Sheet, TextInput } from '../../components/ui'
import { COLOR_KEYS, TURNO_COLORS, turnoColor } from '../../lib/colors'
import { useData } from '../../lib/data'
import { useLocalId } from '../../lib/local'
import { supabase } from '../../lib/supabase'
import { duracion, fmtHoras, hhmm } from '../../lib/time'
import type { TipoTurno } from '../../lib/types'

type Draft = { id?: string; nombre: string; inicio: string; fin: string; color: string }

export function TurnosTab() {
  const localId = useLocalId()
  const { tipos, refresh } = useData()
  const toast = useToast()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmar, setConfirmar] = useState(false)

  const activos = tipos.filter((t) => !t.archivado)
  const archivados = tipos.filter((t) => t.archivado)
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
      ...(draft.id ? {} : { orden: tipos.length + 1 }),
    }
    const { error } = draft.id
      ? await supabase.from('tipos_turno').update(fila).eq('id', draft.id)
      : await supabase.from('tipos_turno').insert(fila)
    setBusy(false)
    if (error) return toast.show('No se pudo guardar. Probá de nuevo.', { tone: 'error' })
    toast.show(draft.id ? `Se actualizó ${fila.nombre}` : `Se creó el turno ${fila.nombre}`)
    setDraft(null)
    refresh()
  }

  /** Si el turno ya se usó, se archiva (el historial guarda su propia copia del horario). */
  const eliminar = async () => {
    if (!supabase || !draft?.id) return
    setBusy(true)
    const { count } = await supabase.from('asignaciones').select('id', { count: 'exact', head: true }).eq('tipo_turno_id', draft.id)
    if ((count ?? 0) > 0) {
      await supabase.from('tipos_turno').update({ archivado: true }).eq('id', draft.id)
      toast.show(`${draft.nombre} ya se usó: se archivó y el historial queda igual`)
    } else {
      const { error } = await supabase.from('tipos_turno').delete().eq('id', draft.id)
      toast.show(error ? 'No se pudo eliminar.' : `Se eliminó ${draft.nombre}`, { tone: error ? 'error' : 'ok' })
    }
    setBusy(false)
    setConfirmar(false)
    setDraft(null)
    refresh()
  }

  const restaurar = async (t: TipoTurno) => {
    if (!supabase) return
    await supabase.from('tipos_turno').update({ archivado: false }).eq('id', t.id)
    toast.show(`${t.nombre} vuelve a estar disponible`)
    refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0 max-w-xl text-sm text-muted">
          Son las opciones para asignar en la semana. <span className="font-medium text-ink-2">Otro horario</span> siempre está disponible para excepciones.
        </p>
        <Button variant="primary" onClick={() => setDraft({ nombre: '', inicio: '09:00', fin: '17:00', color: 'azul' })} icon={<Plus size={17} />}>
          Nuevo turno
        </Button>
      </div>

      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
        {activos.map((t) => {
          const c = turnoColor(t.color)
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setDraft({ id: t.id, nombre: t.nombre, inicio: hhmm(t.inicio), fin: hhmm(t.fin), color: t.color })}
                className="group flex w-full items-center gap-4 rounded-2xl border border-line bg-card p-4 text-left shadow-card transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-line-strong hover:shadow-[0_6px_16px_-8px_rgba(28,29,26,0.2)] active:translate-y-0"
              >
                <span
                  aria-hidden="true"
                  className="flex size-12 shrink-0 items-center justify-center rounded-xl border"
                  style={{ background: c.bg, color: c.fg, borderColor: c.bd }}
                >
                  <Clock size={20} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold">{t.nombre}</span>
                  <span className="font-mono text-[13px] text-muted">
                    {hhmm(t.inicio)} – {hhmm(t.fin)}
                  </span>
                </span>
                <span className="rounded-full bg-foot px-2 py-0.5 font-mono text-xs text-ink-2">{fmtHoras(duracion(t.inicio, t.fin))}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {archivados.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="m-0 flex items-center gap-2 px-0.5 text-[13px] font-semibold text-muted">
            <Archive size={14} aria-hidden="true" />
            Archivados
          </h3>
          <ul className="m-0 list-none overflow-hidden rounded-2xl border border-line bg-card p-0">
            {archivados.map((t, i) => (
              <li key={t.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-divider' : ''}`}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] font-medium text-muted">{t.nombre}</span>
                  <span className="font-mono text-xs text-faint">
                    {hhmm(t.inicio)} – {hhmm(t.fin)}
                  </span>
                </span>
                <Button size="sm" onClick={() => restaurar(t)} icon={<ArchiveRestore size={15} />}>
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
        subtitle={draft?.id ? draft.nombre : 'Una opción más para asignar'}
        onClose={() => setDraft(null)}
        footer={
          <>
            {draft?.id && (
              <Button variant="ghost" onClick={() => setConfirmar(true)} icon={<Trash2 size={16} />} className="text-danger hover:bg-danger-soft hover:text-danger">
                Eliminar
              </Button>
            )}
            <span className="flex-1" />
            <Button onClick={() => setDraft(null)}>Cancelar</Button>
            <Button variant="primary" onClick={guardar} disabled={!valido} loading={busy}>
              {draft?.id ? 'Guardar cambios' : 'Crear turno'}
            </Button>
          </>
        }
      >
        {draft && (
          <>
            <Field label="Nombre" hint="Ej.: Mañana, Madrugada, Refuerzo">
              {(id) => <TextInput id={id} value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} />}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Entrada">
                {(id) => (
                  <TextInput id={id} type="time" step={900} value={draft.inicio} onChange={(e) => setDraft({ ...draft, inicio: e.target.value })} className="font-mono" />
                )}
              </Field>
              <Field label="Salida">
                {(id) => (
                  <TextInput id={id} type="time" step={900} value={draft.fin} onChange={(e) => setDraft({ ...draft, fin: e.target.value })} className="font-mono" />
                )}
              </Field>
            </div>
            {draft.inicio && draft.fin && draft.inicio !== draft.fin && (
              <p className="m-0 -mt-2 text-[13px] text-muted">
                Duración <span className="font-mono font-semibold text-ink">{fmtHoras(duracion(draft.inicio, draft.fin))}</span>
                {draft.fin < draft.inicio && ' · termina al día siguiente y cuenta como el día en que empieza'}
              </p>
            )}
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-2 p-0 text-[13px] font-medium text-ink-2">Color</legend>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {COLOR_KEYS.map((k) => {
                  const c = TURNO_COLORS[k]
                  const on = draft.color === k
                  return (
                    <label
                      key={k}
                      title={c.label}
                      className={`flex h-12 cursor-pointer items-center justify-center rounded-xl border transition-[box-shadow,transform] duration-150 active:scale-[0.94] ${
                        on ? 'shadow-[0_0_0_2px_var(--color-card),0_0_0_4px_var(--color-olive)]' : 'hover:scale-[1.04]'
                      }`}
                      style={{ background: c.bg, borderColor: c.bd, color: c.fg }}
                    >
                      <input type="radio" name="color" value={k} checked={on} onChange={() => setDraft({ ...draft, color: k })} className="sr-only" />
                      <span className="text-[11px] font-semibold">{c.label}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
            <div className="rounded-2xl border border-line bg-head p-4">
              <span className="mb-2 block text-xs font-medium text-muted">Así se va a ver</span>
              {(() => {
                const c = turnoColor(draft.color)
                return (
                  <span className="inline-flex flex-col rounded-[10px] border px-3 py-1.5" style={{ background: c.bg, color: c.fg, borderColor: c.bd }}>
                    <span className="font-mono text-[13px] font-semibold">
                      {draft.inicio.slice(0, 2)}–{draft.fin.slice(0, 2)}
                    </span>
                    <span className="text-xs opacity-85">{draft.nombre || 'Nombre del turno'}</span>
                  </span>
                )
              })()}
            </div>
            {draft.id && <p className="m-0 text-xs text-muted">Los cambios aplican a lo que asignes de ahora en adelante. Lo ya asignado conserva su horario.</p>}
          </>
        )}
      </Sheet>

      <ConfirmDialog
        open={confirmar}
        title={`¿Eliminar ${draft?.nombre ?? ''}?`}
        message="Si ya se usó en alguna semana, se archiva: deja de aparecer para asignar, pero el historial queda igual."
        confirmLabel="Eliminar"
        danger
        busy={busy}
        onConfirm={eliminar}
        onCancel={() => setConfirmar(false)}
      />
    </div>
  )
}
