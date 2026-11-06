import { useEffect, useState } from 'react'
import { Avatar } from '../../components/ui'
import { turnoColor } from '../../lib/colors'
import { hoyISO } from '../../lib/fechas'
import { EJE_DESDE, EJE_HORAS, HORAS_EJE, geometria, rango, type VistaProps } from './helpers'

/** Posición (en %) de la hora actual sobre el eje, o null si está fuera. */
function useAhora(activo: boolean) {
  const calc = () => {
    const d = new Date()
    const h = (d.getHours() + d.getMinutes() / 60 - EJE_DESDE + 24) % 24
    return h <= EJE_HORAS ? (h / EJE_HORAS) * 100 : null
  }
  const [pos, setPos] = useState(calc)
  useEffect(() => {
    if (!activo) return
    const t = window.setInterval(() => setPos(calc()), 60_000)
    return () => window.clearInterval(t)
  }, [activo])
  return activo ? pos : null
}

/** Un día por horas: columnas = horas (05–02), filas = personas por área. Tocar una fila abre el editor. */
export function DiaPorHoras({ grupos, turnosDe, fecha, onAbrir }: VistaProps) {
  const ahora = useAhora(fecha === hoyISO())

  return (
    <div className="flex flex-col gap-4">
      {grupos.map(({ area, empleados }) => {
        const trabajan = empleados.filter((e) => turnosDe(e.id, fecha).some((a) => !a.ausente)).length
        return (
          <section key={area.id} className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
            <div className="flex items-center justify-between border-b border-line bg-foot px-4 py-2 lg:px-5">
              <h2 className="m-0 text-xs font-semibold tracking-wide text-ink-2 uppercase">{area.nombre}</h2>
              <span className="font-mono text-[11px] text-muted">
                <span className="font-semibold text-ink">{trabajan}</span>/{empleados.length} trabajan
              </span>
            </div>
            <div className="flex gap-3 border-b border-divider px-4 pt-2 pb-1.5 lg:px-5">
              <div className="w-[104px] shrink-0 lg:w-52" />
              <div aria-hidden="true" className="relative grid min-w-0 flex-1 grid-cols-[repeat(21,minmax(0,1fr))]">
                {HORAS_EJE.map((h, i) => (
                  <span key={h} className={`-translate-x-1/2 font-mono text-[10px] text-faint ${i % 3 !== 0 ? 'max-lg:invisible' : ''}`}>
                    {h}
                  </span>
                ))}
              </div>
            </div>

            {empleados.map((e, idx) => {
              const turnos = turnosDe(e.id, fecha)
              const resumen = turnos.length ? turnos.map((a) => `${a.nombre_turno} ${rango(a)}`).join(', ') : 'libre'
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onAbrir(e, fecha)}
                  aria-label={`${e.nombre}: ${resumen}. Editar turno`}
                  className={`group flex h-14 w-full items-center gap-3 px-4 text-left transition-colors hover:bg-head active:bg-hover lg:px-5 ${
                    idx > 0 ? 'border-t border-divider' : ''
                  }`}
                >
                  <span className="flex w-[104px] shrink-0 items-center gap-2.5 lg:w-52">
                    <Avatar nombre={e.nombre} size={28} muted={turnos.length === 0} />
                    <span className="flex min-w-0 flex-col">
                      <span className={`truncate text-[13px] leading-tight font-semibold ${turnos.length === 0 ? 'text-muted' : ''}`}>
                        {e.nombre.split(' ')[0]}
                        <span className="hidden lg:inline"> {e.nombre.split(' ').slice(1).join(' ')}</span>
                      </span>
                      <span className="truncate text-[11px] leading-tight text-muted">{e.puesto}</span>
                    </span>
                  </span>
                  <span className="timeline-grid relative h-8 min-w-0 flex-1">
                    {turnos.length === 0 && (
                      <span className="absolute inset-y-0 left-1 flex items-center text-xs text-faint transition-colors group-hover:text-muted">
                        Libre · asignar
                      </span>
                    )}
                    {turnos.map((a) => {
                      const g = geometria(a.inicio_plan, a.fin_plan)
                      const c = turnoColor(a.color)
                      return (
                        <span
                          key={a.id}
                          className="absolute inset-y-0 flex items-center justify-center overflow-hidden border font-mono text-[10px] font-semibold whitespace-nowrap shadow-xs transition-[filter] group-hover:brightness-[0.98] lg:text-[11px]"
                          style={{
                            left: `${g.left}%`,
                            width: `${g.width}%`,
                            borderRadius: g.cortada ? '9px 0 0 9px' : 9,
                            background: a.ausente ? '#FFFFFF' : c.bg,
                            color: a.ausente ? '#A33A2C' : c.fg,
                            borderColor: a.ausente ? '#F0C6BE' : c.bd,
                          }}
                        >
                          {a.ausente ? 'Ausente' : rango(a)}
                        </span>
                      )
                    })}
                    {ahora !== null && (
                      <span aria-hidden="true" className="pointer-events-none absolute -inset-y-3 w-px bg-danger/60" style={{ left: `${ahora}%` }} />
                    )}
                  </span>
                </button>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
