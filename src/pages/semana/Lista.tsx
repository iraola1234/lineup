import { useMemo } from 'react'
import { Avatar } from '../../components/ui'
import { TURNO_COLORS, turnoColor } from '../../lib/colors'
import type { Empleado, OpcionTurno } from '../../lib/types'
import { HorasContrato, abreviaturas, rango, type VistaProps } from './helpers'

type Props = VistaProps & { onPick: (emp: Empleado, fecha: string, op: OpcionTurno) => void }

/** Asignación rápida: un toque por persona. "O" (otro horario) abre el editor. */
export function Lista({ grupos, tipos, turnosDe, horasSemana, fecha, onAbrir, onPick }: Props) {
  const abr = useMemo(() => abreviaturas(tipos), [tipos])
  const neutral = { bg: '#FFFFFF', fg: '#6B6A63', bd: '#E6E4DD' }

  return (
    <div className="flex flex-col gap-4">
      {grupos.map(({ area, empleados }) => (
        <section key={area.id} className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-line bg-foot px-4 py-2">
            <h2 className="m-0 text-xs font-semibold tracking-wide text-ink-2 uppercase">{area.nombre}</h2>
            <span className="font-mono text-[11px] text-muted">{empleados.length}</span>
          </div>
          <ul className="m-0 list-none p-0">
            {empleados.map((e, idx) => {
              const turnos = turnosDe(e.id, fecha)
              const actual = turnos[0]
              const partido = turnos.length > 1
              const opciones = [
                {
                  key: 'libre',
                  label: '–',
                  aria: 'Libre',
                  on: turnos.length === 0,
                  c: { bg: '#ECEAE4', fg: '#1C1D1A', bd: '#D6D3CA' },
                  pick: () => onPick(e, fecha, null),
                },
                ...tipos.map((t) => ({
                  key: t.id,
                  label: abr.get(t.id) ?? '?',
                  aria: t.nombre,
                  on: !partido && actual?.tipo_turno_id === t.id,
                  c: turnoColor(t.color),
                  pick: () => onPick(e, fecha, { tipo: t }),
                })),
                {
                  key: 'otro',
                  label: 'O',
                  aria: 'Otro horario',
                  on: partido || (!!actual && actual.tipo_turno_id === null),
                  c: TURNO_COLORS.especial,
                  pick: () => onAbrir(e, fecha),
                },
              ]
              return (
                <li key={e.id} className={`flex flex-col gap-2.5 px-4 py-3 ${idx > 0 ? 'border-t border-divider' : ''}`}>
                  <button type="button" onClick={() => onAbrir(e, fecha)} className="-mx-1 flex items-center gap-3 rounded-xl px-1 text-left hover:bg-head">
                    <Avatar nombre={e.nombre} size={34} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-[15px] font-semibold">{e.nombre}</span>
                        {turnos.length > 0 && (
                          <span className="font-mono text-[11px] whitespace-nowrap text-muted">{turnos.map(rango).join(' + ')}</span>
                        )}
                      </span>
                      <HorasContrato horas={horasSemana.get(e.id) ?? 0} contrato={e.horas_contrato_semana} />
                    </span>
                  </button>
                  <div role="group" aria-label={`Turno de ${e.nombre}`} className="flex flex-wrap gap-1.5">
                    {opciones.map((o) => {
                      const c = o.on ? o.c : neutral
                      return (
                        <button
                          key={o.key}
                          type="button"
                          aria-label={o.aria}
                          aria-pressed={o.on}
                          title={o.aria}
                          onClick={o.pick}
                          className={`h-11 min-w-11 flex-1 rounded-xl border px-2 text-[13px] font-semibold transition-[background-color,border-color,transform] duration-150 active:scale-[0.94] ${
                            o.on ? 'shadow-xs' : 'hover:border-line-strong hover:bg-hover'
                          }`}
                          style={{ background: c.bg, color: c.fg, borderColor: c.bd }}
                        >
                          {o.label}
                        </button>
                      )
                    })}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
