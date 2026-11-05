import { useState } from 'react'
import { Button, Field, Notice, Sheet, TextInput } from '../../components/ui'
import { useLocalId } from '../../lib/local'
import { supabase } from '../../lib/supabase'
import type { Area, Empleado } from '../../lib/types'
import { FK_VIOLATION, useTabla } from '../../lib/useTabla'

type Draft = { id?: string; nombre: string }

export function AreasTab() {
  const localId = useLocalId()
  const areas = useTabla<Area>('areas', localId, [{ col: 'orden' }, { col: 'nombre' }])
  const emps = useTabla<Empleado>('empleados', localId)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const cuantos = (areaId: string) => emps.rows.filter((e) => e.area_id === areaId && e.activo).length

  const guardar = async () => {
    if (!supabase || !draft || !draft.nombre.trim()) return
    setBusy(true)
    const nombre = draft.nombre.trim()
    const { error } = draft.id
      ? await supabase.from('areas').update({ nombre }).eq('id', draft.id)
      : await supabase.from('areas').insert({ local_id: localId, nombre, orden: areas.rows.length + 1 })
    setBusy(false)
    if (error) return setMsg({ tone: 'error', text: 'No se pudo guardar.' })
    setMsg({ tone: 'ok', text: draft.id ? `Se renombró a ${nombre}.` : `Se creó el área ${nombre}.` })
    setDraft(null)
    areas.reload()
  }

  const eliminar = async () => {
    if (!supabase || !draft?.id) return
    setBusy(true)
    const { error } = await supabase.from('areas').delete().eq('id', draft.id)
    setBusy(false)
    if (error?.code === FK_VIOLATION) {
      setMsg({ tone: 'error', text: `${draft.nombre} tiene empleados asignados. Pasalos a otra área antes de eliminarla.` })
    } else if (error) {
      setMsg({ tone: 'error', text: 'No se pudo eliminar.' })
    } else {
      setMsg({ tone: 'ok', text: `Se eliminó ${draft.nombre}.` })
    }
    setDraft(null)
    areas.reload()
  }

  /** Mueve un área una posición arriba o abajo (define el orden en la grilla y en la imagen). */
  const mover = async (i: number, dir: -1 | 1) => {
    if (!supabase) return
    const lista = [...areas.rows]
    const j = i + dir
    if (j < 0 || j >= lista.length) return
    ;[lista[i], lista[j]] = [lista[j], lista[i]]
    await Promise.all(lista.map((a, idx) => supabase!.from('areas').update({ orden: idx + 1 }).eq('id', a.id)))
    areas.reload()
  }

  if (areas.loading) return <p className="text-sm text-muted">Cargando…</p>
  if (areas.error) return <Notice tone="error">{areas.error}</Notice>

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-sm text-muted">Agrupan al equipo en la grilla y en la imagen para WhatsApp, en este orden.</p>
        <Button variant="primary" onClick={() => setDraft({ nombre: '' })}>
          <span aria-hidden="true" className="text-lg leading-none">+</span> Nueva área
        </Button>
      </div>

      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <ul className="m-0 list-none overflow-hidden rounded-2xl border border-line bg-card p-0">
        {areas.rows.map((a, i) => (
          <li key={a.id} className={`flex items-center gap-2 py-2 pr-2 pl-4 ${i > 0 ? 'border-t border-divider' : ''}`}>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-semibold">{a.nombre}</span>
              <span className="text-xs text-muted">
                <span className="font-mono">{cuantos(a.id)}</span> empleados activos
              </span>
            </span>
            <button
              type="button"
              aria-label={`Subir ${a.nombre}`}
              disabled={i === 0}
              onClick={() => mover(i, -1)}
              className="flex size-11 items-center justify-center rounded-xl text-muted hover:bg-head disabled:opacity-30"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M6 15l6-6 6 6" />
              </svg>
            </button>
            <button
              type="button"
              aria-label={`Bajar ${a.nombre}`}
              disabled={i === areas.rows.length - 1}
              onClick={() => mover(i, 1)}
              className="flex size-11 items-center justify-center rounded-xl text-muted hover:bg-head disabled:opacity-30"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <Button className="h-9" onClick={() => setDraft({ id: a.id, nombre: a.nombre })}>
              Editar
            </Button>
          </li>
        ))}
      </ul>

      <Sheet
        open={!!draft}
        title={draft?.id ? 'Editar área' : 'Nueva área'}
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
            <Button variant="primary" onClick={guardar} disabled={!draft?.nombre.trim() || busy}>
              {busy ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        {draft && (
          <Field label="Nombre" hint="Ej.: Salón, Cocina, Barra">
            {(id) => <TextInput id={id} value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} />}
          </Field>
        )}
      </Sheet>
    </div>
  )
}
