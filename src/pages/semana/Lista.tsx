import { useMemo } from 'react'
import { TURNO_COLORS, turnoColor } from '../../lib/colors'
import { ContratoPill, abreviaturas, porArea, rango, type VistaProps } from './helpers'

/** Fila por empleado con botones de turno de un toque y el contador de contrato. */
export function Lista({ areas, empleados, tipos, turnosDe, horasSemana, fecha, onPick, onEditar }: VistaProps) {
  const abr = useMemo(() => abreviaturas(tipos), [tipos])
  const neutral = { bg: '#FFFFFF', fg: '#6B6A63', bd: '#E7E5DF' }

  return (
    <div className="flex flex-col gap-4">
      {porArea(areas, empleados).map(({ area, empleados: lista }) => (
        <section key={area.id} className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="m-0 text-[13px] font-semibold text-muted">{area.nombre}</h2>
            <span className="font-mono text-xs text-muted">{lista.length} personas</span>
          </div>
          <ul className="m-0 list-none overflow-hidden rounded-2xl border border-line bg-card p-0">
            {lista.map((e, idx) => {
              const turnos = turnosDe(e.id, fecha)
              const actual = turnos[0]
              const opciones = [
                { key: 'libre', label: '–', aria: 'Libre', on: !actual, c: { bg: '#EFEDE8', fg: '#1C1D1A', bd: '#D9D6CE' }, pick: () => onPick(e, fecha, null) },
                ...tipos.map((t) => ({
                  key: t.id,
                  label: abr.get(t.id) ?? '?',
                  aria: `${t.nombre}`,
                  on: actual?.tipo_turno_id === t.id,
                  c: turnoColor(t.color),
                  pick: () => onPick(e, fecha, { tipo: t }),
                })),
                {
                  key: 'otro',
                  label: 'O',
                  aria: 'Otro horario',
                  on: !!actual && actual.tipo_turno_id === null,
                  c: TURNO_COLORS.especial,
                  pick: () => onEditar(e, fecha),
                },
              ]
              return (
                <li
                  key={e.id}
                  className={`flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 pr-2.5 pl-4 lg:flex-nowrap lg:px-5 ${
                    idx > 0 ? 'border-t border-divider' : ''
                  }`}
                >
                  <div className="flex min-w-[150px] flex-1 flex-col gap-1">
                    <span className="truncate text-[15px] font-semibold">{e.nombre}</span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {e.puesto && <span className="text-xs text-muted">{e.puesto}</span>}
                      <ContratoPill horas={horasSemana.get(e.id) ?? 0} contrato={e.horas_contrato_semana} />
                      {actual && actual.tipo_turno_id === null && (
                        <span className="font-mono text-[11px] text-muted">{rango(actual)}</span>
                      )}
                    </span>
                  </div>
                  <div role="group" aria-label={`Turno de ${e.nombre}`} className="flex flex-wrap gap-1">
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
                          className="h-11 min-w-10 rounded-full border px-2.5 text-[13px] font-semibold"
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
