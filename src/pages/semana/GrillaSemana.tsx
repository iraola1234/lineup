import { Copy, MoreHorizontal, Move, Plus, Trash2, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  onEliminar: (asignacionId: string) => void
  accionesDia: (fecha: string) => MenuItem[]
  /** Encargados: ven la grilla sin poder editar ni arrastrar. */
  soloLectura?: boolean
}

/** Estado interno del arrastre (se muta en cada movimiento sin volver a dibujar la grilla). */
type DragRef = {
  a: Asignacion
  sx: number
  sy: number
  offX: number
  offY: number
  w: number
  h: number
  x: number
  y: number
  activo: boolean
  copiar: boolean
  destino: string | null // "empleadoId|fecha" o "papelera"
}

type DragView = { id: string; copiar: boolean; destino: string | null }

export const ES_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const UMBRAL = 5 // px que hay que mover antes de que empiece el arrastre (si no, es un clic)

/**
 * Computadora: toda la semana de un vistazo (columnas = días, filas = personas por área).
 * Clic en un casillero para asignar. Arrastrar un turno lo mueve; con ⌘ (Ctrl en Windows) lo copia;
 * soltarlo en la papelera lo elimina.
 */
export function GrillaSemana({ grupos, dias, hoy, turnosDe, horasSemana, onAbrir, onMover, onEliminar, accionesDia, soloLectura = false }: Props) {
  const todos = useMemo(() => grupos.flatMap((g) => g.empleados), [grupos])
  const porId = useMemo(() => new Map(todos.map((e) => [e.id, e])), [todos])

  const dragRef = useRef<DragRef | null>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragView | null>(null)
  const suprimirClick = useRef(false)
  const cbs = useRef({ onMover, onEliminar, porId })
  useEffect(() => {
    cbs.current = { onMover, onEliminar, porId }
  })

  useEffect(() => {
    const sync = (d: DragRef) => {
      document.body.classList.toggle('copiando', d.copiar && d.destino !== 'papelera')
      setDrag((v) =>
        v && v.copiar === d.copiar && v.destino === d.destino && v.id === d.a.id ? v : { id: d.a.id, copiar: d.copiar, destino: d.destino },
      )
    }
    const terminar = () => {
      dragRef.current = null
      document.body.classList.remove('arrastrando', 'copiando')
      setDrag(null)
    }
    const modificador = (e: { metaKey: boolean; ctrlKey: boolean; altKey: boolean }) => (ES_MAC ? e.metaKey || e.altKey : e.ctrlKey || e.altKey)

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      if (!d.activo) {
        if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < UMBRAL) return
        d.activo = true
        document.body.classList.add('arrastrando')
      }
      d.x = e.clientX - d.offX
      d.y = e.clientY - d.offY
      d.copiar = modificador(e)
      if (ghostRef.current) ghostRef.current.style.transform = `translate(${d.x}px, ${d.y}px) rotate(-2deg)`

      const el = document.elementFromPoint(e.clientX, e.clientY)
      d.destino = el?.closest('[data-papelera]') ? 'papelera' : (el?.closest<HTMLElement>('[data-celda]')?.dataset.celda ?? null)

      // Desplazamiento automático solo en una franja fina del borde (y nunca sobre la papelera).
      const main = document.querySelector('main')
      if (main && d.destino !== 'papelera') {
        const r = main.getBoundingClientRect()
        const borde = 36
        if (e.clientY < r.top + borde) main.scrollBy({ top: -14 })
        else if (e.clientY > r.bottom - borde) main.scrollBy({ top: 14 })
      }
      sync(d)
    }

    const onUp = () => {
      const d = dragRef.current
      if (!d) return
      if (d.activo) {
        suprimirClick.current = true
        window.setTimeout(() => (suprimirClick.current = false), 0)
        if (d.destino === 'papelera') {
          cbs.current.onEliminar(d.a.id)
        } else if (d.destino) {
          const [empId, fecha] = d.destino.split('|')
          const emp = cbs.current.porId.get(empId)
          if (emp) cbs.current.onMover(d.a.id, emp, fecha, d.copiar)
        }
      }
      terminar()
    }

    const onKey = (e: KeyboardEvent) => {
      const d = dragRef.current
      if (!d?.activo) return
      if (e.key === 'Escape') {
        suprimirClick.current = true
        window.setTimeout(() => (suprimirClick.current = false), 0)
        terminar()
        return
      }
      d.copiar = modificador(e)
      sync(d)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', terminar)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', terminar)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      document.body.classList.remove('arrastrando', 'copiando')
    }
  }, [])

  const empezar = (e: React.PointerEvent<HTMLElement>, a: Asignacion) => {
    if (e.button !== 0 || e.pointerType === 'touch' || a.id.startsWith('tmp-')) return
    const r = e.currentTarget.getBoundingClientRect()
    dragRef.current = {
      a,
      sx: e.clientX,
      sy: e.clientY,
      offX: e.clientX - r.left,
      offY: e.clientY - r.top,
      w: r.width,
      h: r.height,
      x: r.left,
      y: r.top,
      activo: false,
      copiar: false,
      destino: null,
    }
  }

  const totalDia = (d: string) => {
    const t = todos.flatMap((e) => turnosDe(e.id, d))
    return { personas: new Set(t.filter((a) => !a.ausente).map((a) => a.empleado_id)).size, horas: horasTotales(t) }
  }
  const totales = dias.map(totalDia)
  const totalSemana = totales.reduce((s, t) => s + t.horas, 0)
  const personasSemana = new Set(grupos.flatMap((g) => g.empleados).filter((e) => dias.some((d) => turnosDe(e.id, d).some((a) => !a.ausente))).map((e) => e.id)).size

  const d = dragRef.current
  const enPapelera = drag?.destino === 'papelera'
  const modo = enPapelera ? 'eliminar' : drag?.copiar ? 'copiar' : 'mover'
  const destinoEmp = drag?.destino && !enPapelera ? porId.get(drag.destino.split('|')[0]) : undefined
  const destinoFecha = drag?.destino && !enPapelera ? drag.destino.split('|')[1] : undefined

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-line bg-card shadow-card 2xl:overflow-visible">
        <table className="w-full min-w-[920px] table-fixed border-separate border-spacing-0 text-left">
          <colgroup>
            <col className="w-[232px]" />
            {dias.map((dia) => (
              <col key={dia} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="sticky top-0 z-20 rounded-tl-2xl border-b border-line bg-head px-4 pt-2.5 pb-2 text-left align-top">
                <span className="flex flex-col gap-1">
                  <span className="text-xs leading-6 font-medium text-muted">Equipo</span>
                  <span className="flex items-center gap-2 font-mono text-[11px] font-normal text-muted" title="Total de la semana">
                    <span className="font-sans font-semibold text-ink-2">Total semana</span>
                    <span className="inline-flex items-center gap-0.5" title="Personas con turno">
                      <Users size={11} aria-hidden="true" />
                      {personasSemana}
                    </span>
                    <span className="font-semibold text-ink">{fmtHoras(totalSemana)}</span>
                  </span>
                </span>
              </th>
              {dias.map((dia, i) => {
                const esHoy = dia === hoy
                const t = totales[i]
                return (
                  <th key={dia} className="group/th sticky top-0 z-20 border-b border-l border-line bg-head p-0 align-top last:rounded-tr-2xl">
                    <div className="flex items-start justify-between gap-1 px-3 pt-2.5 pb-2">
                      <div className="flex flex-col gap-1">
                        <span className="flex items-baseline gap-1.5">
                          <span className={`text-xs font-medium ${esHoy ? 'text-olive' : 'text-muted'}`}>{DIAS_ABR[indiceDia(dia)]}</span>
                          <span
                            className={`font-mono text-[15px] font-semibold ${
                              esHoy ? 'flex size-6 items-center justify-center rounded-full bg-olive text-[13px] text-white' : 'text-ink'
                            }`}
                          >
                            {numeroDia(dia)}
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
                      {!soloLectura && <Menu
                        items={accionesDia(dia)}
                        trigger={({ toggle, ref, open }) => (
                          <button
                            ref={ref}
                            type="button"
                            onClick={toggle}
                            aria-label={`Acciones del ${fechaCorta(dia)}`}
                            aria-expanded={open}
                            className={`-mr-1.5 flex size-8 items-center justify-center rounded-lg text-muted transition-[opacity,background-color] hover:bg-press hover:text-ink focus-visible:opacity-100 ${
                              open ? 'bg-press opacity-100' : 'opacity-0 group-hover/th:opacity-100'
                            }`}
                          >
                            <MoreHorizontal size={16} />
                          </button>
                        )}
                      />}
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
                  {dias.map((dia) => {
                    const key = `${e.id}|${dia}`
                    const turnos = turnosDe(e.id, dia)
                    const esDestino = !!drag && drag.destino === key
                    return (
                      <td
                        key={dia}
                        data-celda={key}
                        className={`border-b border-l border-divider p-1 align-top transition-colors duration-100 ${
                          dia === hoy ? 'bg-olive-soft/35' : ''
                        } ${esDestino ? 'bg-olive-soft!' : drag ? '' : 'group-hover/row:bg-head/50'}`}
                      >
                        <div
                          className={`relative flex min-h-[52px] flex-col gap-1 rounded-xl ${
                            esDestino ? 'outline-2 outline-offset-[-1px] outline-dashed outline-olive/60' : ''
                          }`}
                        >
                          {turnos.map((a) => {
                            const c = turnoColor(a.color)
                            const tmp = a.id.startsWith('tmp-')
                            const origen = drag?.id === a.id
                            return (
                              <button
                                key={a.id}
                                type="button"
                                disabled={soloLectura}
                                onPointerDown={soloLectura ? undefined : (ev) => empezar(ev, a)}
                                onClick={() => {
                                  if (!suprimirClick.current) onAbrir(e, dia)
                                }}
                                aria-label={`${e.nombre}, ${fechaCorta(dia)}: ${a.nombre_turno} ${rango(a)}${soloLectura ? '' : '. Editar'}`}
                                className={`flex flex-1 flex-col items-start justify-center rounded-[10px] border px-2 py-1.5 text-left transition-[transform,box-shadow,opacity] duration-150 select-none disabled:cursor-default ${
                                  soloLectura ? '' : 'touch-none'
                                } ${
                                  drag || soloLectura ? '' : 'cursor-grab hover:-translate-y-px hover:shadow-[0_3px_10px_-4px_rgba(28,29,26,0.35)] active:translate-y-0'
                                } ${origen && modo !== 'copiar' ? 'opacity-35' : ''} ${origen && modo === 'copiar' ? 'ring-2 ring-olive/40' : ''} ${
                                  tmp ? 'opacity-80' : ''
                                }`}
                                style={{
                                  background: a.ausente ? '#FFFFFF' : c.bg,
                                  color: a.ausente ? '#A33A2C' : c.fg,
                                  borderColor: a.ausente ? '#F0C6BE' : c.bd,
                                }}
                              >
                                <span className="font-mono text-[12px] leading-tight font-semibold">{a.ausente ? 'Ausente' : rango(a)}</span>
                                {turnos.length === 1 && <span className="max-w-full truncate text-[11px] leading-tight opacity-85">{a.nombre_turno}</span>}
                              </button>
                            )
                          })}
                          {turnos.length === 0 && !soloLectura && (
                            <button
                              type="button"
                              onClick={() => onAbrir(e, dia)}
                              aria-label={`${e.nombre}, ${fechaCorta(dia)}: libre. Asignar turno`}
                              className={`flex flex-1 items-center justify-center rounded-[10px] border border-dashed border-transparent text-transparent transition-colors ${
                                drag ? '' : 'hover:border-line-strong hover:bg-card hover:text-muted focus-visible:border-line-strong focus-visible:text-muted'
                              }`}
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

        </table>
      </div>

      {drag &&
        d &&
        createPortal(
          <>
            {/* Tarjeta que sigue al mouse */}
            <div
              ref={ghostRef}
              aria-hidden="true"
              className="pointer-events-none fixed top-0 left-0 z-[90] flex flex-col gap-1.5"
              style={{ width: d.w, transform: `translate(${d.x}px, ${d.y}px) rotate(-2deg)` }}
            >
              {(() => {
                const c = turnoColor(d.a.color)
                return (
                  <div
                    className={`flex origin-top-left flex-col items-start rounded-[10px] border px-2 py-1.5 shadow-[0_14px_30px_-10px_rgba(28,29,26,0.45)] transition-[opacity,transform] duration-150 ${
                      enPapelera ? 'scale-50 opacity-40' : ''
                    }`}
                    style={{ height: d.h, background: c.bg, color: c.fg, borderColor: c.bd }}
                  >
                    <span className="font-mono text-[12px] leading-tight font-semibold">{rango(d.a)}</span>
                    <span className="text-[11px] leading-tight opacity-85">{d.a.nombre_turno}</span>
                  </div>
                )
              })()}
              <span
                className={`inline-flex items-center gap-1 self-start rounded-full px-2 py-0.5 text-[11px] font-semibold text-white shadow-xs ${
                  modo === 'eliminar' ? 'bg-danger' : modo === 'copiar' ? 'bg-olive' : 'bg-[#23251F]'
                }`}
              >
                {modo === 'eliminar' ? <Trash2 size={11} /> : modo === 'copiar' ? <Copy size={11} /> : <Move size={11} />}
                {modo === 'eliminar'
                  ? 'Eliminar'
                  : destinoEmp && destinoFecha
                    ? `${modo === 'copiar' ? 'Copiar' : 'Mover'} a ${destinoEmp.nombre.split(' ')[0]} · ${fechaCorta(destinoFecha)}`
                    : modo === 'copiar'
                      ? 'Copiar'
                      : 'Mover'}
              </span>
            </div>

            {/* Papelera */}
            <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[85] flex justify-center">
              <div
                data-papelera
                className={`pointer-events-auto flex animate-toast-in items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-4 shadow-pop transition-[background-color,border-color,color,transform] duration-150 ${
                  enPapelera ? 'scale-105 border-danger bg-danger text-white' : 'border-danger-line bg-card text-danger'
                }`}
              >
                <Trash2 size={22} />
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">{enPapelera ? 'Soltá para eliminar' : 'Arrastrá acá para eliminar'}</span>
                  <span className={`text-xs ${enPapelera ? 'text-white/80' : 'text-muted'}`}>Vas a poder deshacerlo</span>
                </span>
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  )
}
