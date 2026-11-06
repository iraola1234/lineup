import { useState } from 'react'
import { turnoColor } from '../../lib/colors'
import { HORAS_EJE, geometria, porArea, rango, type VistaProps } from './helpers'
import { TurnoPicker } from './TurnoPicker'

/** Tabla con columnas = horas (05–02) y filas = empleados por área. Tocar una fila abre las opciones. */
export function PorHoras({ areas, empleados, tipos, turnosDe, fecha, onPick }: VistaProps) {
  const [abierto, setAbierto] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-4">
      {porArea(areas, empleados).map(({ area, empleados: lista }) => {
        const trabajan = lista.filter((e) => turnosDe(e.id, fecha).some((a) => !a.ausente)).length
        return (
          <section key={area.id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="m-0 text-[13px] font-semibold text-muted">{area.nombre}</h2>
              <span className="font-mono text-xs text-muted">
                {trabajan}/{lista.length} trabajan
              </span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-line bg-card">
              <div className="flex gap-2 border-b border-line bg-head px-3 pt-2.5 pb-2 lg:px-5">
                <div className="w-[88px] shrink-0 text-[11px] font-medium text-muted lg:w-48">Empleado</div>
                <div aria-hidden="true" className="grid min-w-0 flex-1 grid-cols-[repeat(21,minmax(0,1fr))]">
                  {HORAS_EJE.map((h, i) => (
                    <span
                      key={h}
                      className={`font-mono text-[10px] whitespace-nowrap text-muted ${i % 3 !== 0 ? 'max-lg:invisible' : ''}`}
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </div>

              {lista.map((e, idx) => {
                const turnos = turnosDe(e.id, fecha)
                const open = abierto === e.id
                const resumen = turnos.length ? turnos.map((a) => `${a.nombre_turno} ${rango(a)}`).join(', ') : 'libre'
                return (
                  <div
                    key={e.id}
                    className={`px-3 lg:px-5 ${idx > 0 ? 'border-t border-divider' : ''} ${open ? 'bg-head' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => setAbierto(open ? null : e.id)}
                      aria-expanded={open}
                      aria-label={`${e.nombre}: ${resumen}. Cambiar turno`}
                      className="flex h-12 w-full items-center gap-2 text-left"
                    >
                      <span className="flex w-[88px] shrink-0 flex-col lg:w-48">
                        <span className="truncate text-[13px] font-semibold lg:text-sm">{e.nombre}</span>
                        <span className="truncate text-[11px] text-muted lg:text-xs">{e.puesto}</span>
                      </span>
                      <span className="timeline-grid relative h-[26px] min-w-0 flex-1 lg:h-7">
                        {turnos.length === 0 && (
                          <span className="absolute top-[5px] left-1 text-[11px] text-muted">Libre · tocá para asignar</span>
                        )}
                        {turnos.map((a) => {
                          const g = geometria(a.inicio_plan, a.fin_plan)
                          const c = turnoColor(a.color)
                          return (
                            <span
                              key={a.id}
                              className="absolute inset-y-0 flex items-center justify-center overflow-hidden border font-mono text-[10px] font-semibold whitespace-nowrap lg:text-[11px]"
                              style={{
                                left: `${g.left}%`,
                                width: `${g.width}%`,
                                borderRadius: g.cortada ? '8px 0 0 8px' : 8,
                                background: a.ausente ? '#FFFFFF' : c.bg,
                                color: a.ausente ? '#A33A2C' : c.fg,
                                borderColor: a.ausente ? '#F0C6BE' : c.bd,
                              }}
                            >
                              {a.ausente ? 'Ausente' : rango(a)}
                            </span>
                          )
                        })}
                      </span>
                    </button>
                    {open && (
                      <div className="pt-1 pb-3 lg:max-w-2xl lg:pl-[200px]">
                        <TurnoPicker
                          key={`${e.id}-${fecha}`}
                          tipos={tipos}
                          actual={turnos[0]}
                          onPick={(op) => {
                            onPick(e, fecha, op)
                            if (op === null || 'tipo' in op) setAbierto(null)
                          }}
                          onDone={() => setAbierto(null)}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
