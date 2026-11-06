import { Check, Clock, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Avatar, Button, Sheet, inputCls } from '../../components/ui'
import { TURNO_COLORS, turnoColor } from '../../lib/colors'
import { fechaLarga } from '../../lib/fechas'
import { corta, duracion, fmtHoras, hhmm } from '../../lib/time'
import type { Asignacion, Empleado, OpcionTurno, TipoTurno } from '../../lib/types'
import { HorasContrato, rango } from './helpers'

type Props = {
  open: boolean
  emp: Empleado | null
  fecha: string
  turnos: Asignacion[]
  tipos: TipoTurno[]
  horasSemana: number
  onClose: () => void
  /** Reemplaza todos los turnos del día por esta opción (null = libre). */
  onSet: (op: OpcionTurno) => void
  /** Agrega un turno más ese día (turno partido). */
  onAdd: (op: Exclude<OpcionTurno, null>) => void
  /** Quita un turno puntual (cuando hay más de uno). */
  onRemove: (id: string) => void
}

/** Hoja para asignar o cambiar el turno de una persona en un día. */
export function EditorTurno({ open, emp, fecha, turnos, tipos, horasSemana, onClose, onSet, onAdd, onRemove }: Props) {
  if (!emp) return null
  return (
    <Sheet
      open={open}
      onClose={onClose}
      autoFocus={false}
      leading={<Avatar nombre={emp.nombre} size={40} />}
      title={emp.nombre}
      subtitle={fechaLarga(fecha)}
    >
      <Contenido
        key={`${emp.id}-${fecha}`}
        emp={emp}
        turnos={turnos}
        tipos={tipos}
        horasSemana={horasSemana}
        onSet={onSet}
        onAdd={onAdd}
        onRemove={onRemove}
      />
    </Sheet>
  )
}

function Contenido({
  emp,
  turnos,
  tipos,
  horasSemana,
  onSet,
  onAdd,
  onRemove,
}: Omit<Props, 'open' | 'emp' | 'fecha' | 'onClose'> & { emp: Empleado }) {
  const actualOtro = turnos.length === 1 && turnos[0].tipo_turno_id === null ? turnos[0] : null
  const [agregando, setAgregando] = useState(false)
  const [otroAbierto, setOtroAbierto] = useState(!!actualOtro)
  const [inicio, setInicio] = useState(actualOtro ? hhmm(actualOtro.inicio_plan) : '')
  const [fin, setFin] = useState(actualOtro ? hhmm(actualOtro.fin_plan) : '')
  const otroValido = inicio !== '' && fin !== '' && inicio !== fin

  const elegir = (op: Exclude<OpcionTurno, null>) => (agregando ? onAdd(op) : onSet(op))
  const seleccionado = (t: TipoTurno) => !agregando && turnos.length === 1 && turnos[0].tipo_turno_id === t.id
  const especial = TURNO_COLORS.especial

  return (
    <>
      <div className="-mt-1 flex items-center justify-between gap-3 rounded-xl bg-head px-3.5 py-2.5">
        <span className="text-[13px] text-muted">
          {emp.puesto ? `${emp.puesto} · ` : ''}esta semana
        </span>
        <span className="w-36">
          <HorasContrato horas={horasSemana} contrato={emp.horas_contrato_semana} />
        </span>
      </div>

      {turnos.length > 1 && (
        <section className="flex flex-col gap-2">
          <h3 className="m-0 text-[13px] font-semibold text-ink-2">Turnos de este día</h3>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {turnos.map((a) => {
              const c = turnoColor(a.color)
              return (
                <li key={a.id} className="flex items-center gap-3 rounded-xl border border-line py-2 pr-2 pl-3">
                  <span aria-hidden="true" className="h-8 w-1.5 rounded-full" style={{ background: c.bd === c.bg ? c.bg : c.fg }} />
                  <span className="flex flex-1 flex-col">
                    <span className="text-sm font-semibold">{a.nombre_turno}</span>
                    <span className="font-mono text-xs text-muted">
                      {rango(a)} · {fmtHoras(Number(a.horas_plan))}
                    </span>
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => onRemove(a.id)} icon={<Trash2 size={15} />} className="text-danger hover:text-danger">
                    Quitar
                  </Button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h3 className="m-0 text-[13px] font-semibold text-ink-2">
            {agregando ? 'Agregar otro turno ese día' : turnos.length ? 'Cambiar turno' : 'Asignar turno'}
          </h3>
          {agregando && (
            <button type="button" onClick={() => setAgregando(false)} className="text-[13px] font-medium text-olive hover:underline">
              Cancelar
            </button>
          )}
        </div>

        <div role="group" aria-label="Tipos de turno" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {tipos.map((t) => {
            const c = turnoColor(t.color)
            const on = seleccionado(t)
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => elegir({ tipo: t })}
                className={`group relative flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-[border-color,box-shadow,transform,background-color] duration-150 active:scale-[0.97] ${
                  on ? 'shadow-[0_0_0_2px_var(--color-olive)]' : 'border-line hover:border-line-strong hover:bg-hover'
                }`}
                style={on ? { background: c.bg, borderColor: c.bd } : undefined}
              >
                <span className="flex w-full items-center gap-2">
                  <span aria-hidden="true" className="size-3 rounded-full border" style={{ background: c.bg, borderColor: c.bd === c.bg ? c.bg : c.bd }} />
                  <span className="flex-1 truncate text-sm font-semibold" style={on ? { color: c.fg } : undefined}>
                    {t.nombre}
                  </span>
                  {on && (
                    <span className="flex size-5 items-center justify-center rounded-full bg-olive text-white">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className="font-mono text-xs text-muted" style={on ? { color: c.fg } : undefined}>
                  {corta(t.inicio)}–{corta(t.fin)} · {fmtHoras(duracion(t.inicio, t.fin))}
                </span>
              </button>
            )
          })}
          <button
            type="button"
            aria-pressed={otroAbierto}
            aria-expanded={otroAbierto}
            onClick={() => setOtroAbierto((v) => !v)}
            className={`relative flex flex-col items-start gap-1 rounded-2xl border border-dashed p-3 text-left transition-[border-color,background-color,transform] duration-150 active:scale-[0.97] ${
              otroAbierto ? 'border-solid' : 'border-line-strong hover:bg-hover'
            }`}
            style={otroAbierto ? { background: especial.bg, borderColor: especial.bd } : undefined}
          >
            <span className="flex items-center gap-2">
              <Clock size={14} className={otroAbierto ? 'text-danger' : 'text-muted'} aria-hidden="true" />
              <span className="text-sm font-semibold" style={otroAbierto ? { color: especial.fg } : undefined}>
                Otro horario
              </span>
            </span>
            <span className="text-xs text-muted">Entrada y salida a mano</span>
          </button>
        </div>

        {otroAbierto && (
          <div className="flex animate-fade-in flex-col gap-3 rounded-2xl border border-line bg-head p-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
                Entrada
                <input type="time" step={900} value={inicio} onChange={(e) => setInicio(e.target.value)} className={`${inputCls} font-mono`} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
                Salida
                <input type="time" step={900} value={fin} onChange={(e) => setFin(e.target.value)} className={`${inputCls} font-mono`} />
              </label>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted">
                {otroValido ? (
                  <>
                    <span className="font-mono font-semibold text-ink">{fmtHoras(duracion(inicio, fin))}</span>
                    {fin < inicio && ' · termina al día siguiente'}
                  </>
                ) : (
                  'Elegí entrada y salida'
                )}
              </span>
              <Button variant="primary" size="sm" disabled={!otroValido} onClick={() => elegir({ otro: { inicio, fin } })}>
                {agregando ? 'Agregar' : 'Asignar'}
              </Button>
            </div>
          </div>
        )}
      </section>

      {!agregando && (
        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-divider pt-4">
          {turnos.length > 0 && (
            <Button variant="danger" size="sm" onClick={() => onSet(null)} icon={<Trash2 size={15} />}>
              {turnos.length > 1 ? 'Quitar todos (libre)' : 'Marcar libre'}
            </Button>
          )}
          <span className="flex-1" />
          {turnos.length >= 1 && (
            <Button variant="subtle" size="sm" onClick={() => setAgregando(true)} icon={<Plus size={15} />}>
              Turno partido
            </Button>
          )}
        </div>
      )}
    </>
  )
}
