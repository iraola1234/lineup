import { turnoColor } from '../../lib/colors'
import { fechaCorta, hoyISO } from '../../lib/fechas'
import type { Area, Asignacion, Empleado } from '../../lib/types'
import { ContratoPill, porArea, rango } from './helpers'

type Props = {
  areas: Area[]
  empleados: Empleado[]
  dias: string[]
  diaSeleccionado: string
  turnosDe: (empleadoId: string, fecha: string) => Asignacion[]
  horasSemana: Map<string, number>
  onCelda: (emp: Empleado, fecha: string) => void
  onDia: (fecha: string) => void
}

/** Computadora: toda la semana de un vistazo. Columnas = días, filas = empleados por área. */
export function SemanaCompleta({ areas, empleados, dias, diaSeleccionado, turnosDe, horasSemana, onCelda, onDia }: Props) {
  const hoy = hoyISO()
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-card">
      <table className="w-full min-w-[960px] border-collapse text-left">
        <thead>
          <tr className="bg-head text-[13px] text-muted">
            <th className="w-56 px-5 py-3 font-medium">Empleado</th>
            {dias.map((d) => (
              <th key={d} className="p-1.5 font-medium">
                <button
                  type="button"
                  onClick={() => onDia(d)}
                  className={`flex h-9 w-full items-center justify-center gap-1 rounded-lg ${
                    d === diaSeleccionado ? 'bg-olive text-white' : 'hover:bg-card'
                  }`}
                >
                  {fechaCorta(d)}
                  {d === hoy && d !== diaSeleccionado && <span aria-label="hoy" className="size-1.5 rounded-full bg-khaki" />}
                </button>
              </th>
            ))}
            <th className="w-24 px-4 py-3 text-right font-medium">Contrato</th>
          </tr>
        </thead>
        {porArea(areas, empleados).map(({ area, empleados: lista }) => (
          <tbody key={area.id}>
            <tr>
              <th
                colSpan={dias.length + 2}
                className="border-t border-line bg-foot px-5 py-2 text-xs font-semibold tracking-wide text-muted uppercase"
              >
                {area.nombre}
              </th>
            </tr>
            {lista.map((e) => (
              <tr key={e.id} className="border-t border-divider">
                <th scope="row" className="px-5 py-1.5 text-left font-normal">
                  <span className="block truncate text-sm font-semibold">{e.nombre}</span>
                  <span className="block truncate text-xs text-muted">{e.puesto}</span>
                </th>
                {dias.map((d) => {
                  const turnos = turnosDe(e.id, d)
                  const sel = d === diaSeleccionado
                  return (
                    <td key={d} className={`p-1 ${sel ? 'bg-head' : ''}`}>
                      <button
                        type="button"
                        onClick={() => onCelda(e, d)}
                        aria-label={`${e.nombre}, ${fechaCorta(d)}: ${
                          turnos.length ? turnos.map((a) => `${a.nombre_turno} ${rango(a)}`).join(', ') : 'libre'
                        }`}
                        className="group flex h-12 w-full flex-col items-stretch justify-center gap-0.5 rounded-lg"
                      >
                        {turnos.length === 0 && (
                          <span className="flex h-full items-center justify-center rounded-lg border border-dashed border-transparent text-lg text-transparent group-hover:border-line group-hover:text-muted">
                            +
                          </span>
                        )}
                        {turnos.map((a) => {
                          const c = turnoColor(a.color)
                          return (
                            <span
                              key={a.id}
                              className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-lg border leading-tight"
                              style={{
                                background: a.ausente ? '#FFFFFF' : c.bg,
                                color: a.ausente ? '#A33A2C' : c.fg,
                                borderColor: a.ausente ? '#F0C6BE' : c.bd,
                              }}
                            >
                              <span className="max-w-full truncate px-1 text-xs font-semibold">
                                {a.ausente ? 'Ausente' : a.nombre_turno}
                              </span>
                              {turnos.length === 1 && <span className="font-mono text-[10px]">{rango(a)}</span>}
                            </span>
                          )
                        })}
                      </button>
                    </td>
                  )
                })}
                <td className="px-4 text-right">
                  <ContratoPill horas={horasSemana.get(e.id) ?? 0} contrato={e.horas_contrato_semana} />
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}
