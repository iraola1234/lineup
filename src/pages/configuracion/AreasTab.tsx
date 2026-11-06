import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '../../components/toast'
import { Button, ConfirmDialog, Field, IconButton, Sheet, TextInput } from '../../components/ui'
import { useData } from '../../lib/data'
import { useLocalId } from '../../lib/local'
import { supabase } from '../../lib/supabase'

const FK_VIOLATION = '23503'
type Draft = { id?: string; nombre: string }

export function AreasTab() {
  const localId = useLocalId()
  const { areas, empleados, refresh } = useData()
  const toast = useToast()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmar, setConfirmar] = useState(false)

  const cuantos = (areaId: string) => empleados.filter((e) => e.area_id === areaId && e.activo).length

  const guardar = async () => {
    if (!supabase || !draft || !draft.nombre.trim()) return
    setBusy(true)
    const nombre = draft.nombre.trim()
    const { error } = draft.id
      ? await supabase.from('areas').update({ nombre }).eq('id', draft.id)
      : await supabase.from('areas').insert({ local_id: localId, nombre, orden: areas.length + 1 })
    setBusy(false)
    if (error) return toast.show('No se pudo guardar.', { tone: 'error' })
    toast.show(draft.id ? `Se renombró a ${nombre}` : `Se creó el área ${nombre}`)
    setDraft(null)
    refresh()
  }

  const eliminar = async () => {
    if (!supabase || !draft?.id) return
    setBusy(true)
    const { error } = await supabase.from('areas').delete().eq('id', draft.id)
    setBusy(false)
    setConfirmar(false)
    if (error?.code === FK_VIOLATION) {
      toast.show(`${draft.nombre} tiene empleados. Pasalos a otra área antes de eliminarla.`, { tone: 'error' })
      return
    }
    toast.show(error ? 'No se pudo eliminar.' : `Se eliminó ${draft.nombre}`, { tone: error ? 'error' : 'ok' })
    setDraft(null)
    refresh()
  }

  /** Mueve un área una posición (define el orden en la grilla y en la imagen). */
  const mover = async (i: number, dir: -1 | 1) => {
    if (!supabase) return
    const lista = [...areas]
    const j = i + dir
    if (j < 0 || j >= lista.length) return
    ;[lista[i], lista[j]] = [lista[j], lista[i]]
    await Promise.all(lista.map((a, idx) => supabase!.from('areas').update({ orden: idx + 1 }).eq('id', a.id)))
    refresh()
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0 text-sm text-muted">Agrupan al equipo en la semana y en la imagen para WhatsApp, en este orden.</p>
        <Button variant="primary" onClick={() => setDraft({ nombre: '' })} icon={<Plus size={17} />}>
          Nueva área
        </Button>
      </div>

      <ul className="m-0 list-none overflow-hidden rounded-2xl border border-line bg-card p-0 shadow-card">
        {areas.map((a, i) => (
          <li key={a.id} className={`flex items-center gap-1 py-2 pr-2 pl-4 transition-colors hover:bg-head ${i > 0 ? 'border-t border-divider' : ''}`}>
            <span className="mr-2 font-mono text-xs text-faint">{i + 1}</span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-semibold">{a.nombre}</span>
              <span className="text-xs text-muted">
                <span className="font-mono">{cuantos(a.id)}</span> {cuantos(a.id) === 1 ? 'persona activa' : 'personas activas'}
              </span>
            </span>
            <IconButton label={`Subir ${a.nombre}`} disabled={i === 0} onClick={() => mover(i, -1)}>
              <ChevronUp size={18} />
            </IconButton>
            <IconButton label={`Bajar ${a.nombre}`} disabled={i === areas.length - 1} onClick={() => mover(i, 1)}>
              <ChevronDown size={18} />
            </IconButton>
            <IconButton label={`Renombrar ${a.nombre}`} onClick={() => setDraft({ id: a.id, nombre: a.nombre })}>
              <Pencil size={16} />
            </IconButton>
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
              <Button variant="ghost" onClick={() => setConfirmar(true)} icon={<Trash2 size={16} />} className="text-danger hover:bg-danger-soft hover:text-danger">
                Eliminar
              </Button>
            )}
            <span className="flex-1" />
            <Button onClick={() => setDraft(null)}>Cancelar</Button>
            <Button variant="primary" onClick={guardar} disabled={!draft?.nombre.trim()} loading={busy}>
              Guardar
            </Button>
          </>
        }
      >
        {draft && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              guardar()
            }}
          >
            <Field label="Nombre" hint="Ej.: Salón, Cocina, Barra">
              {(id) => <TextInput id={id} value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} />}
            </Field>
          </form>
        )}
      </Sheet>

      <ConfirmDialog
        open={confirmar}
        title={`¿Eliminar ${draft?.nombre ?? ''}?`}
        message="Solo se puede eliminar un área sin empleados asignados."
        confirmLabel="Eliminar"
        danger
        busy={busy}
        onConfirm={eliminar}
        onCancel={() => setConfirmar(false)}
      />
    </div>
  )
}
