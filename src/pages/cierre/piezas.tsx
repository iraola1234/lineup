import { Check, Minus, Plus, RotateCcw, UserCheck, UserX } from 'lucide-react'
import { Avatar, IconButton, Pill, pillDanger, pillNeutral, pillOk, pillWarn } from '../../components/ui'
import { turnoColor } from '../../lib/colors'
import { horasReales } from '../../lib/semana'
import { fmtHoras, toHours } from '../../lib/time'
import type { Asignacion, Empleado } from '../../lib/types'
import { rango } from '../semana/helpers'

export type Estado = 'sin' | 'futuro' | 'pendiente' | 'confirmado'

export const ESTADO_PILL: Record<Estado, { label: string; tono: typeof pillOk }> = {
  sin: { label: 'Sin turnos', tono: pillNeutral },
  futuro: { label: 'Todavía no', tono: pillNeutral },
  pendiente: { label: 'Pendiente', tono: pillWarn },
  confirmado: { label: 'Confirmado', tono: pillOk },
}

/** Orden por hora de entrada, siguiendo el día de trabajo (05:00 → 04:59). */
export const ordenEntrada = (a: Asignacion) => (toHours(a.inicio_plan) - 5 + 24) % 24
export const sinUnidad = (h: number) => fmtHoras(h).replace(' h', '')
export const horaDe = (iso: string) => new Date(iso).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', hour12: false })


export function Dato({ titulo, valor, unidad, destacado = false }: { titulo: string; valor: string; unidad?: string; destacado?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-foot px-3 py-2.5">
      <dt className="text-[11px] font-medium text-muted">{titulo}</dt>
      <dd className={`m-0 font-mono text-[20px] leading-none font-semibold tracking-tight ${destacado ? 'text-olive' : 'text-ink'}`}>
        {valor}
        {unidad && <span className="ml-0.5 text-[12px] font-medium text-muted">{unidad}</span>}
      </dd>
    </div>
  )
}

export function EstadoMini({ estado, invertido }: { estado: Estado; invertido: boolean }) {
  if (estado === 'confirmado')
    return (
      <span className={`flex size-3.5 items-center justify-center rounded-full ${invertido ? 'bg-white text-olive' : 'bg-olive text-white'}`}>
        <Check size={9} strokeWidth={3.2} aria-hidden="true" />
      </span>
    )
  if (estado === 'pendiente') return <span aria-hidden="true" className={`size-2 rounded-full ${invertido ? 'bg-[#F1D9AE]' : 'bg-[#D9A54A]'}`} />
  return <span aria-hidden="true" className={`h-0.5 w-2.5 rounded-full ${invertido ? 'bg-white/40' : 'bg-line-strong'}`} />
}

export function EstadoIcono({ estado }: { estado: Estado }) {
  if (estado === 'confirmado')
    return (
      <span title="Confirmado" className="flex size-6 items-center justify-center rounded-full bg-olive text-white">
        <Check size={13} strokeWidth={3} aria-label="Confirmado" />
      </span>
    )
  if (estado === 'pendiente')
    return (
      <span title="Pendiente" className="flex size-6 items-center justify-center">
        <span className="size-2.5 rounded-full bg-[#D9A54A]" aria-label="Pendiente" />
      </span>
    )
  return null
}

export function FilaCierre({
  a,
  emp,
  segundo,
  editable,
  onHoras,
  onAusente,
}: {
  a: Asignacion
  emp: Empleado | undefined
  segundo: boolean
  editable: boolean
  onHoras: (h: number) => void
  onAusente: (v: boolean) => void
}) {
  const nombre = emp?.nombre ?? 'Persona'
  const h = horasReales(a)
  const plan = Number(a.horas_plan)
  const corregido = !a.ausente && a.horas_reales !== null && Number(a.horas_reales) !== plan
  const c = turnoColor(a.color)

  return (
    <li className={`flex items-center gap-3 border-b border-divider px-4 py-3 last:border-b-0 lg:gap-4 lg:px-5 ${a.ausente ? 'bg-[#FCF8F7]' : ''}`}>
      <span className="max-sm:hidden">
        <Avatar nombre={nombre} size={36} muted={a.ausente} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={`flex items-center gap-1.5 truncate text-sm font-semibold ${a.ausente ? 'text-muted' : ''}`}>
          <span className="truncate">{nombre}</span>
          {segundo && <span className="shrink-0 text-[11px] font-medium text-faint">2.º turno</span>}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full border" style={{ background: c.bg, borderColor: c.bd }} />
          <span className="truncate">
            <span className="max-sm:hidden">{a.nombre_turno} </span>
            <span className="font-mono">{rango(a)}</span>
          </span>
          {corregido &&
            (editable ? (
              <button
                type="button"
                onClick={() => onHoras(plan)}
                title={`Volver a ${fmtHoras(plan)} planificadas`}
                className="-my-1 inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-1 font-mono text-[11px] text-olive transition-colors hover:bg-olive-soft active:bg-olive-line"
              >
                <RotateCcw size={11} aria-hidden="true" />
                <span className="max-sm:hidden">plan</span> {sinUnidad(plan)}
              </button>
            ) : (
              <span className="shrink-0 font-mono text-[11px] text-faint">plan {sinUnidad(plan)}</span>
            ))}
        </span>
      </div>

      {a.ausente ? (
        <Pill {...pillDanger} className="h-9 w-[124px] justify-center !rounded-xl !text-[12px] font-semibold">
          <UserX size={13} aria-hidden="true" />
          Ausente
        </Pill>
      ) : editable ? (
        <div role="group" aria-label={`Horas de ${nombre}`} className="flex h-9 shrink-0 items-center rounded-xl border border-line bg-card shadow-xs">
          <button
            type="button"
            aria-label="Media hora menos"
            disabled={h <= 0}
            onClick={() => onHoras(h - 0.5)}
            className="flex size-9 items-center justify-center rounded-l-xl text-ink-2 transition-colors hover:bg-hover active:bg-press disabled:opacity-35"
          >
            <Minus size={15} />
          </button>
          <output
            aria-live="polite"
            className={`w-[52px] border-x border-line text-center font-mono text-[13px] leading-[34px] font-semibold tabular-nums ${corregido ? 'bg-olive-soft text-olive' : ''}`}
          >
            {sinUnidad(h)}
            <span className="text-[10px] font-medium opacity-70">{' '}h</span>
          </output>
          <button
            type="button"
            aria-label="Media hora más"
            disabled={h >= 24}
            onClick={() => onHoras(h + 0.5)}
            className="flex size-9 items-center justify-center rounded-r-xl text-ink-2 transition-colors hover:bg-hover active:bg-press disabled:opacity-35"
          >
            <Plus size={15} />
          </button>
        </div>
      ) : (
        <span className={`w-[124px] text-right font-mono text-[14px] font-semibold tabular-nums ${corregido ? 'text-olive' : ''}`}>{fmtHoras(h)}</span>
      )}

      {editable && (
        <IconButton
          size="sm"
          label={a.ausente ? `Marcar a ${nombre} como presente` : `Marcar a ${nombre} como ausente`}
          onClick={() => onAusente(!a.ausente)}
          className={a.ausente ? 'bg-danger-soft text-danger hover:bg-[#F3D3CC] hover:text-danger' : 'hover:bg-danger-soft hover:text-danger'}
        >
          {a.ausente ? <UserCheck size={17} /> : <UserX size={17} />}
        </IconButton>
      )}
    </li>
  )
}
