import { Users } from 'lucide-react'
import { turnoColor } from '../../lib/colors'
import { DIAS_LETRA, fechaCorta, fechaLarga, indiceDia, numeroDia } from '../../lib/fechas'
import { corta, fmtHoras } from '../../lib/time'
import type { Asignacion, Empleado } from '../../lib/types'
import { horasTotales, rango, type Grupo } from './helpers'

type Props = {
  grupos: Grupo[]
  dias: string[]
  hoy: string
  turnosDe: (empleadoId: string, fecha: string) => Asignacion[]
  horasSemana: Map<string, number>
  onAbrir: (emp: Empleado, fecha: string) => void
  onVerDia: (fecha: string) => void
}

/**
 * Celular: la semana completa en una pantalla. Filas = personas, columnas = días.
 * Cada casillero muestra entrada y salida con el color del turno; tocarlo abre el editor.
 */
export function SemanaMovil({ grupos, dias, hoy, turnosDe, horasSemana, onAbrir, onVerDia }: Props) {
  const todos = grupos.flatMap((g) => g.empleados)
  const totales = dias.map((d) => {
    const t = todos.flatMap((e) => turnosDe(e.id, d))
    return { personas: new Set(t.filter((a) => !a.ausente).map((a) => a.empleado_id)).size, horas: horasTotales(t) }
  })
  const cols = 'grid-cols-[84px_repeat(7,minmax(0,1fr))]'

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
      {/* Encabezado de días: tocar uno abre ese día por horas */}
      <div className={`sticky top-0 z-10 grid ${cols} border-b border-line bg-head`}>
        <div className="flex flex-col justify-end gap-0.5 px-2.5 pb-1.5 leading-tight">
          <span className="text-[10px] font-medium text-muted">Total semana</span>
          <span className="font-mono text-[13px] font-semibold text-ink">{fmtHoras(totales.reduce((s, t) => s + t.horas, 0))}</span>
        </div>
        {dias.map((d, i) => {
          const esHoy = d === hoy
          return (
            <button
              key={d}
              type="button"
              onClick={() => onVerDia(d)}
              aria-label={`Ver ${fechaLarga(d)} por horas`}
              className="flex flex-col items-center gap-0.5 border-l border-divider py-1.5 transition-colors active:bg-press"
            >
              <span className={`text-[10px] font-medium ${esHoy ? 'text-olive' : 'text-muted'}`}>{DIAS_LETRA[indiceDia(d)]}</span>
              <span
                className={`flex size-6 items-center justify-center rounded-full font-mono text-[13px] font-semibold ${
                  esHoy ? 'bg-olive text-white' : 'text-ink'
                }`}
              >
                {numeroDia(d)}
              </span>
              <span className="flex items-center gap-0.5 font-mono text-[9px] text-faint">
                <Users size={8} aria-hidden="true" />
                {totales[i].personas}
              </span>
              <span className="font-mono text-[9px] font-semibold text-ink-2" aria-label={`${Math.round(totales[i].horas)} horas`}>
                {Math.round(totales[i].horas)}h
              </span>
            </button>
          )
        })}
      </div>

      {grupos.map(({ area, empleados }) => (
        <section key={area.id}>
          <div className="flex items-center justify-between border-b border-line bg-foot px-2.5 py-1.5">
            <h2 className="m-0 text-[11px] font-semibold tracking-wide text-ink-2 uppercase">{area.nombre}</h2>
            <span className="font-mono text-[10px] text-muted">{empleados.length}</span>
          </div>
          {empleados.map((e) => {
            const horas = horasSemana.get(e.id) ?? 0
            const pasado = horas > e.horas_contrato_semana
            return (
              <div key={e.id} className={`grid ${cols} border-b border-divider last:border-b-0`}>
                <div className="flex min-w-0 flex-col justify-center px-2.5 py-1.5">
                  <span className="truncate text-[12px] leading-tight font-semibold">{e.nombre.split(' ')[0]}</span>
                  <span className={`font-mono text-[10px] leading-tight ${pasado ? 'font-semibold text-danger' : 'text-muted'}`}>
                    {fmtHoras(horas).replace(' h', '')}/{e.horas_contrato_semana}
                  </span>
                </div>
                {dias.map((d) => {
                  const turnos = turnosDe(e.id, d)
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onAbrir(e, d)}
                      aria-label={`${e.nombre}, ${fechaCorta(d)}: ${
                        turnos.length ? turnos.map((a) => `${a.nombre_turno} ${rango(a)}`).join(', ') : 'libre'
                      }`}
                      className={`flex min-h-12 flex-col gap-0.5 border-l border-divider p-[3px] transition-colors active:bg-press ${
                        d === hoy ? 'bg-olive-soft/40' : ''
                      }`}
                    >
                      {turnos.length === 0 && <span aria-hidden="true" className="m-auto size-1 rounded-full bg-line-strong" />}
                      {turnos.map((a) => {
                        const c = turnoColor(a.color)
                        return (
                          <span
                            key={a.id}
                            className="flex flex-1 flex-col items-center justify-center rounded-md border font-mono leading-none"
                            style={{
                              background: a.ausente ? '#FFFFFF' : c.bg,
                              color: a.ausente ? '#A33A2C' : c.fg,
                              borderColor: a.ausente ? '#F0C6BE' : c.bd,
                            }}
                          >
                            {a.ausente ? (
                              <span className="text-[10px] font-semibold">Aus.</span>
                            ) : (
                              <>
                                <span className="text-[11px] font-semibold">{corta(a.inicio_plan)}</span>
                                {turnos.length === 1 && <span className="mt-0.5 text-[9px] opacity-80">{corta(a.fin_plan)}</span>}
                              </>
                            )}
                          </span>
                        )
                      })}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </section>
      ))}

    </div>
  )
}
