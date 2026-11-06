import { CalendarDays, MoreHorizontal, Plus, Users } from 'lucide-react'
import { useState, type DragEvent } from 'react'
import { Avatar, Menu, type MenuItem } from '../../components/ui'
import { turnoColor } from '../../lib/colors'
import { DIAS_ABR, fechaCorta, indiceDia, numeroDia } from '../../lib/fechas'
import { fmtHoras } from '../../lib/time'
import type { Asignacion, Empleado } from '../../lib/types'
import { HorasContrato, horasTotales, rango, type Grupo } from './helpers'

type Props = {
  grupos: Grupo[]
  dias: string[]
  hoy: string
  turnosDe: (empleadoId: string, fecha: string) => Asignacion[]
  horasSemana: Map<string, number>
  onAbrir: (emp: Empleado, fecha: string) => void
  onMover: (asignacionId: string, destino: Empleado, fecha: string, copiar: boolean) => void
  accionesDia: (fecha: string) => MenuItem[]
}

/**
 * Computadora: toda la semana de un vistazo (columnas = días, filas = personas por área).
 * Clic en un casillero para asignar; arrastrar un turno para moverlo (con Alt/Ctrl, copiarlo).
 */
export function GrillaSemana({ grupos, dias, hoy, turnosDe, horasSemana, onAbrir, onMover, accionesDia }: Props) {
  const [arrastrando, setArrastrando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  const todos = grupos.flatMap((g) => g.empleados)

  const totalDia = (d: string) => {
    const t = todos.flatMap((e) => turnosDe(e.id, d))
    return { personas: new Set(t.filter((a) => !a.ausente).map((a) => a.empleado_id)).size, horas: horasTotales(t) }
  }
  const totales = dias.map(totalDia)
  const totalSemana = totales.reduce((s, t) => s + t.horas, 0)

  const onDragOver = (e: DragEvent, key: string) => {
    if (!arrastrando) return
    e.preventDefault()
    e.dataTransfer.dropEffect = e.altKey || e.ctrlKey || e.metaKey ? 'copy' : 'move'
    if (sobre !== key) setSobre(key)
  }
  const onDrop = (e: DragEvent, emp: Empleado, fecha: string) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    setSobre(null)
    setArrastrando(null)
    if (id) onMover(id, emp, fecha, e.altKey || e.ctrlKey || e.metaKey)
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-card shadow-card 2xl:overflow-visible">
      <table className="w-full min-w-[920px] table-fixed border-separate border-spacing-0 text-left">
        <colgroup>
          <col className="w-[232px]" />
          {dias.map((d) => (
            <col key={d} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="sticky top-0 z-20 rounded-tl-2xl border-b border-line bg-head px-4 py-3 align-bottom text-xs font-medium text-muted">
              Equipo
            </th>
            {dias.map((d, i) => {
              const esHoy = d === hoy
              const t = totales[i]
              return (
                <th key={d} className="group/th sticky top-0 z-20 border-b border-l border-line bg-head p-0 align-top last:rounded-tr-2xl">
                  <div className="flex items-start justify-between gap-1 px-3 pt-2.5 pb-2">
                    <div className="flex flex-col gap-1">
                      <span className="flex items-baseline gap-1.5">
                        <span className={`text-xs font-medium ${esHoy ? 'text-olive' : 'text-muted'}`}>{DIAS_ABR[indiceDia(d)]}</span>
                        <span
                          className={`font-mono text-[15px] font-semibold ${
                            esHoy ? 'flex size-6 items-center justify-center rounded-full bg-olive text-[13px] text-white' : 'text-ink'
                          }`}
                        >
                          {numeroDia(d)}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 font-mono text-[11px] font-normal text-muted">
                        <span className="inline-flex items-center gap-0.5" title="Personas">
                          <Users size={11} aria-hidden="true" />
                          {t.personas}
                        </span>
                        <span title="Horas">{fmtHoras(t.horas)}</span>
                      </span>
                    </div>
                    <Menu
                      items={accionesDia(d)}
                      trigger={({ toggle, ref, open }) => (
                        <button
                          ref={ref}
                          type="button"
                          onClick={toggle}
                          aria-label={`Acciones del ${fechaCorta(d)}`}
                          aria-expanded={open}
                          className={`-mr-1.5 flex size-8 items-center justify-center rounded-lg text-muted transition-[opacity,background-color] hover:bg-press hover:text-ink focus-visible:opacity-100 ${
                            open ? 'bg-press opacity-100' : 'opacity-0 group-hover/th:opacity-100'
                          }`}
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      )}
                    />
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>

        {grupos.map(({ area, empleados }) => (
          <tbody key={area.id}>
            <tr>
              <th colSpan={dias.length + 1} className="border-b border-line bg-foot px-4 py-2 text-left">
                <span className="flex items-center gap-2 text-xs font-semibold tracking-wide text-ink-2 uppercase">
                  {area.nombre}
                  <span className="rounded-full bg-card px-1.5 py-px font-mono text-[10px] font-medium tracking-normal text-muted normal-case">
                    {empleados.length}
                  </span>
                </span>
              </th>
            </tr>
            {empleados.map((e) => (
              <tr key={e.id} className="group/row">
                <th scope="row" className="border-b border-divider px-4 py-2 text-left font-normal group-hover/row:bg-head/70">
                  <span className="flex items-center gap-3">
                    <Avatar nombre={e.nombre} size={32} muted={!e.activo} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-[13px] leading-tight font-semibold">{e.nombre}</span>
                      <HorasContrato horas={horasSemana.get(e.id) ?? 0} contrato={e.horas_contrato_semana} />
                    </span>
                  </span>
                </th>
                {dias.map((d) => {
                  const key = `${e.id}|${d}`
                  const turnos = turnosDe(e.id, d)
                  const esSobre = sobre === key
                  return (
                    <td
                      key={d}
                      onDragOver={(ev) => onDragOver(ev, key)}
                      onDragLeave={() => setSobre((s) => (s === key ? null : s))}
                      onDrop={(ev) => onDrop(ev, e, d)}
                      className={`border-b border-l border-divider p-1 align-top transition-colors ${
                        d === hoy ? 'bg-olive-soft/35' : ''
                      } ${esSobre ? 'bg-olive-soft' : 'group-hover/row:bg-head/50'}`}
                    >
                      <div className={`flex min-h-[52px] flex-col gap-1 rounded-xl ${esSobre ? 'outline-2 outline-dashed outline-olive/50' : ''}`}>
                        {turnos.map((a) => {
                          const c = turnoColor(a.color)
                          const tmp = a.id.startsWith('tmp-')
                          return (
                            <button
                              key={a.id}
                              type="button"
                              draggable={!tmp}
                              onDragStart={(ev) => {
                                ev.dataTransfer.setData('text/plain', a.id)
                                ev.dataTransfer.effectAllowed = 'copyMove'
                                setArrastrando(a.id)
                              }}
                              onDragEnd={() => {
                                setArrastrando(null)
                                setSobre(null)
                              }}
                              onClick={() => onAbrir(e, d)}
                              aria-label={`${e.nombre}, ${fechaCorta(d)}: ${a.nombre_turno} ${rango(a)}. Editar`}
                              className={`flex flex-1 flex-col items-start justify-center rounded-[10px] border px-2 py-1.5 text-left transition-[transform,box-shadow,opacity] duration-150 hover:-translate-y-px hover:shadow-[0_3px_10px_-4px_rgba(28,29,26,0.35)] active:translate-y-0 ${
                                arrastrando === a.id ? 'opacity-40' : ''
                              } ${tmp ? 'opacity-80' : ''} cursor-grab active:cursor-grabbing`}
                              style={{
                                background: a.ausente ? '#FFFFFF' : c.bg,
                                color: a.ausente ? '#A33A2C' : c.fg,
                                borderColor: a.ausente ? '#F0C6BE' : c.bd,
                              }}
                            >
                              <span className="font-mono text-[12px] leading-tight font-semibold">{a.ausente ? 'Ausente' : rango(a)}</span>
                              {turnos.length === 1 && (
                                <span className="max-w-full truncate text-[11px] leading-tight opacity-85">{a.nombre_turno}</span>
                              )}
                            </button>
                          )
                        })}
                        {turnos.length === 0 && (
                          <button
                            type="button"
                            onClick={() => onAbrir(e, d)}
                            aria-label={`${e.nombre}, ${fechaCorta(d)}: libre. Asignar turno`}
                            className="flex flex-1 items-center justify-center rounded-[10px] border border-dashed border-transparent text-transparent transition-colors hover:border-line-strong hover:bg-card hover:text-muted focus-visible:border-line-strong focus-visible:text-muted"
                          >
                            <Plus size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        ))}

        <tfoot>
          <tr>
            <th className="rounded-bl-2xl bg-foot px-4 py-3 text-left">
              <span className="flex items-center gap-2 text-xs font-semibold text-ink-2">
                <CalendarDays size={14} aria-hidden="true" />
                Total semana
                <span className="font-mono font-medium text-muted">{fmtHoras(totalSemana)}</span>
              </span>
            </th>
            {totales.map((t, i) => (
              <td key={dias[i]} className="border-l border-divider bg-foot px-3 py-3 font-mono text-[11px] text-muted last:rounded-br-2xl">
                <span className="font-semibold text-ink">{t.personas}</span> pers · {fmtHoras(t.horas)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
