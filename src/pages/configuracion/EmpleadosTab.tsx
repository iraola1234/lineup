import { ChevronRight, Plus, Search, Trash2, UserPlus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useToast } from '../../components/toast'
import {
  Avatar,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Pill,
  Segmented,
  Select,
  Sheet,
  TextInput,
  Toggle,
  pillDanger,
  pillNeutral,
  pillOk,
} from '../../components/ui'
import { useData } from '../../lib/data'
import { useLocalId } from '../../lib/local'
import { supabase } from '../../lib/supabase'
import type { Empleado } from '../../lib/types'

const FK_VIOLATION = '23503'

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
  const { areas, empleados, refresh } = useData()
  const toast = useToast()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [intentado, setIntentado] = useState(false)
  const [filtro, setFiltro] = useState<'activos' | 'todos'>('activos')
  const [buscar, setBuscar] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)

  const areaNombre = useMemo(() => new Map(areas.map((a) => [a.id, a.nombre])), [areas])
  const activos = empleados.filter((e) => e.activo)
  const q = buscar.trim().toLowerCase()
  const visibles = empleados
    .filter((e) => filtro === 'todos' || e.activo)
    .filter((e) => !q || e.nombre.toLowerCase().includes(q) || e.puesto.toLowerCase().includes(q))

  const nuevo = () => {
    setIntentado(false)
    setDraft({ nombre: '', area_id: areas[0]?.id ?? '', puesto: '', horas: '48', participa_propina: true, activo: true })
  }
  const editar = (e: Empleado) => {
    setIntentado(false)
    setDraft({
      id: e.id,
      nombre: e.nombre,
      area_id: e.area_id,
      puesto: e.puesto,
      horas: String(e.horas_contrato_semana),
      participa_propina: e.participa_propina,
      activo: e.activo,
    })
  }

  const horasNum = draft ? Number(draft.horas.replace(',', '.')) : 0
  const errNombre = draft && !draft.nombre.trim() ? 'Escribí el nombre' : null
  const errHoras = draft && (draft.horas.trim() === '' || isNaN(horasNum) || horasNum < 0 || horasNum > 84) ? 'Entre 0 y 84 horas' : null
  const valido = !!draft && !errNombre && !errHoras && !!draft.area_id

  const guardar = async () => {
    setIntentado(true)
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
    if (error) return toast.show('No se pudo guardar. Probá de nuevo.', { tone: 'error' })
    toast.show(draft.id ? `Se guardaron los cambios de ${fila.nombre}` : `${fila.nombre} se sumó al equipo`)
    setDraft(null)
    refresh()
  }

  /** Si tiene turnos en el historial no se borra: se da de baja para conservar horas y propinas. */
  const eliminar = async () => {
    if (!supabase || !draft?.id) return
    setBusy(true)
    const { error } = await supabase.from('empleados').delete().eq('id', draft.id)
    if (error?.code === FK_VIOLATION) {
      await supabase.from('empleados').update({ activo: false }).eq('id', draft.id)
      toast.show(`${draft.nombre} tiene historial, así que se dio de baja en lugar de borrarse`)
    } else if (error) {
      toast.show('No se pudo eliminar. Probá de nuevo.', { tone: 'error' })
    } else {
      toast.show(`${draft.nombre} se eliminó`)
    }
    setBusy(false)
    setConfirmarBorrar(false)
    setDraft(null)
    refresh()
  }

  const estado = (e: Empleado) => (
    <span className="flex flex-wrap items-center gap-1.5">
      {!e.activo && <Pill {...pillDanger}>De baja</Pill>}
      {!e.participa_propina && <Pill {...pillNeutral}>Sin propina</Pill>}
    </span>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint" aria-hidden="true" />
          <TextInput
            type="search"
            placeholder="Buscar por nombre o puesto"
            aria-label="Buscar empleados"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center justify-between gap-3 sm:contents">
          <Segmented
            label="Filtro"
            value={filtro}
            onChange={setFiltro}
            options={[
              { value: 'activos', label: `Activos · ${activos.length}` },
              { value: 'todos', label: `Todos · ${empleados.length}` },
            ]}
          />
          <span className="hidden flex-1 sm:block" />
          <Button variant="primary" onClick={nuevo} disabled={areas.length === 0} icon={<UserPlus size={17} />}>
            <span className="max-sm:hidden">Nuevo empleado</span>
            <span className="sm:hidden">Nuevo</span>
          </Button>
        </div>
      </div>

      {empleados.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title="Sumá a tu equipo"
          description="Cargá a cada persona con su área y horas de contrato. Después la vas a poder asignar en la semana."
          action={
            <Button variant="primary" onClick={nuevo} icon={<Plus size={17} />}>
              Agregar el primero
            </Button>
          }
        />
      ) : visibles.length === 0 ? (
        <p className="m-0 rounded-2xl border border-line bg-card px-4 py-8 text-center text-sm text-muted">
          Nadie coincide con “{buscar}”.
        </p>
      ) : (
        <>
          {/* Celular: lista por área */}
          <div className="flex flex-col gap-4 lg:hidden">
            {areas.map((area) => {
              const lista = visibles.filter((e) => e.area_id === area.id)
              if (lista.length === 0) return null
              return (
                <section key={area.id} className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
                  <div className="flex items-center justify-between border-b border-line bg-foot px-4 py-2">
                    <h3 className="m-0 text-xs font-semibold tracking-wide text-ink-2 uppercase">{area.nombre}</h3>
                    <span className="font-mono text-[11px] text-muted">{lista.length}</span>
                  </div>
                  <ul className="m-0 list-none p-0">
                    {lista.map((e, i) => (
                      <li key={e.id} className={i > 0 ? 'border-t border-divider' : ''}>
                        <button
                          type="button"
                          onClick={() => editar(e)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-head active:bg-hover"
                        >
                          <Avatar nombre={e.nombre} size={38} muted={!e.activo} />
                          <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className={`truncate text-[15px] font-semibold ${e.activo ? '' : 'text-muted'}`}>{e.nombre}</span>
                            <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                              {e.puesto || 'Sin puesto'}
                              <span className="text-faint">·</span>
                              <span className="font-mono">{e.horas_contrato_semana}{'\u202F'}h/sem</span>
                              {estado(e)}
                            </span>
                          </span>
                          <ChevronRight size={18} className="text-faint" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>

          {/* Computadora: tabla */}
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-card shadow-card lg:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-head text-xs text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Nombre</th>
                  <th className="px-5 py-3 font-medium">Área</th>
                  <th className="px-5 py-3 text-right font-medium">Contrato</th>
                  <th className="px-5 py-3 font-medium">Propina</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="w-12 px-5 py-3">
                    <span className="sr-only">Editar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((e) => (
                  <tr key={e.id} onClick={() => editar(e)} className="group cursor-pointer border-t border-line transition-colors hover:bg-head">
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-3">
                        <Avatar nombre={e.nombre} size={34} muted={!e.activo} />
                        <span className="flex flex-col">
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation()
                              editar(e)
                            }}
                            className={`text-left font-semibold hover:underline ${e.activo ? '' : 'text-muted'}`}
                          >
                            {e.nombre}
                          </button>
                          <span className="text-xs text-muted">{e.puesto || 'Sin puesto'}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink-2">{areaNombre.get(e.area_id)}</td>
                    <td className="px-5 py-3 text-right font-mono text-ink-2">{e.horas_contrato_semana}{'\u202F'}h</td>
                    <td className="px-5 py-3">{e.participa_propina ? <Pill {...pillOk}>Participa</Pill> : <Pill {...pillNeutral}>No</Pill>}</td>
                    <td className="px-5 py-3">{e.activo ? <Pill {...pillOk}>Activo</Pill> : <Pill {...pillDanger}>De baja</Pill>}</td>
                    <td className="px-5 py-3 text-right">
                      <ChevronRight size={18} className="text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden="true" />
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
        title={draft?.id ? draft.nombre || 'Editar empleado' : 'Nuevo empleado'}
        subtitle={draft?.id ? 'Editar datos' : 'Sumar a alguien al equipo'}
        leading={draft?.id ? <Avatar nombre={draft.nombre || '?'} size={40} /> : undefined}
        onClose={() => setDraft(null)}
        footer={
          <>
            {draft?.id && (
              <Button variant="ghost" onClick={() => setConfirmarBorrar(true)} icon={<Trash2 size={16} />} className="text-danger hover:bg-danger-soft hover:text-danger">
                Eliminar
              </Button>
            )}
            <span className="flex-1" />
            <Button onClick={() => setDraft(null)}>Cancelar</Button>
            <Button variant="primary" onClick={guardar} loading={busy}>
              {draft?.id ? 'Guardar cambios' : 'Agregar'}
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
            className="flex flex-col gap-5"
          >
            <Field label="Nombre y apellido" error={intentado ? errNombre : null}>
              {(id) => (
                <TextInput id={id} autoComplete="off" value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} placeholder="Ej.: Lucía Pereira" />
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Área">
                {(id) => (
                  <Select id={id} value={draft.area_id} onChange={(e) => setDraft({ ...draft, area_id: e.target.value })}>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Puesto">
                {(id) => <TextInput id={id} value={draft.puesto} onChange={(e) => setDraft({ ...draft, puesto: e.target.value })} placeholder="Ej.: Moza" />}
              </Field>
            </div>
            <Field label="Horas semanales de contrato" hint="Solo para avisarte si se pasa. Nunca bloquea." error={intentado ? errHoras : null}>
              {(id) => (
                <div className="relative">
                  <TextInput
                    id={id}
                    inputMode="decimal"
                    value={draft.horas}
                    onChange={(e) => setDraft({ ...draft, horas: e.target.value })}
                    className="pr-12 font-mono"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-muted">h</span>
                </div>
              )}
            </Field>
            <div className="flex flex-col divide-y divide-divider rounded-2xl border border-line px-4">
              <Toggle
                label="Participa de las propinas"
                description="Se le reparte según sus horas trabajadas."
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
            <button type="submit" hidden />
          </form>
        )}
      </Sheet>

      <ConfirmDialog
        open={confirmarBorrar}
        title={`¿Eliminar a ${draft?.nombre ?? ''}?`}
        message="Si ya tiene turnos en el historial, se da de baja en lugar de borrarse, para no perder sus horas ni sus propinas."
        confirmLabel="Eliminar"
        danger
        busy={busy}
        onConfirm={eliminar}
        onCancel={() => setConfirmarBorrar(false)}
      />
    </div>
  )
}
