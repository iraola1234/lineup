import { useState } from 'react'
import { inputCls } from '../../components/ui'
import { TURNO_COLORS, turnoColor } from '../../lib/colors'
import { corta, duracion, fmtHoras, hhmm } from '../../lib/time'
import type { Asignacion, OpcionTurno, TipoTurno } from '../../lib/types'

type Props = {
  tipos: TipoTurno[] // solo los activos (no archivados)
  actual: Asignacion | undefined
  onPick: (op: OpcionTurno) => void
  onDone?: () => void
}

/** Opciones para asignar: Libre, cada tipo de turno, y Otro (horario a mano). */
export function TurnoPicker({ tipos, actual, onPick, onDone }: Props) {
  const esOtro = !!actual && actual.tipo_turno_id === null
  const [otroAbierto, setOtroAbierto] = useState(esOtro)
  const [inicio, setInicio] = useState(esOtro ? hhmm(actual!.inicio_plan) : '')
  const [fin, setFin] = useState(esOtro ? hhmm(actual!.fin_plan) : '')
  const otroValido = inicio !== '' && fin !== '' && inicio !== fin

  const neutral = { bg: '#FFFFFF', fg: '#55544E', bd: '#E7E5DF' }
  const libre = { bg: '#EFEDE8', fg: '#1C1D1A', bd: '#D9D6CE' }
  const especial = TURNO_COLORS.especial

  const opciones = [
    { key: 'libre', label: 'Libre', time: 'franco', on: !actual && !otroAbierto, c: libre, pick: () => onPick(null) },
    ...tipos.map((t) => ({
      key: t.id,
      label: t.nombre,
      time: `${corta(t.inicio)}–${corta(t.fin)}`,
      on: actual?.tipo_turno_id === t.id && !otroAbierto,
      c: turnoColor(t.color),
      pick: () => onPick({ tipo: t }),
    })),
    {
      key: 'otro',
      label: 'Otro',
      time: 'a mano',
      on: otroAbierto,
      c: especial,
      pick: () => setOtroAbierto(true),
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Turno" className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-1.5">
        {opciones.map((o) => {
          const c = o.on ? o.c : neutral
          return (
            <button
              key={o.key}
              type="button"
              aria-pressed={o.on}
              onClick={o.pick}
              className="flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl border px-1"
              style={{ background: c.bg, color: c.fg, borderColor: c.bd }}
            >
              <span className="max-w-full truncate text-[13px] font-semibold">{o.label}</span>
              <span className="font-mono text-[10px]">{o.time}</span>
            </button>
          )
        })}
      </div>

      {otroAbierto && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[110px] flex-1 flex-col gap-1 text-xs font-medium text-muted">
            Entrada
            <input
              type="time"
              step={900}
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className={`${inputCls} font-mono`}
            />
          </label>
          <label className="flex min-w-[110px] flex-1 flex-col gap-1 text-xs font-medium text-muted">
            Salida
            <input
              type="time"
              step={900}
              value={fin}
              onChange={(e) => setFin(e.target.value)}
              className={`${inputCls} font-mono`}
            />
          </label>
          <button
            type="button"
            disabled={!otroValido}
            onClick={() => {
              onPick({ otro: { inicio, fin } })
              onDone?.()
            }}
            className="h-12 rounded-xl bg-olive px-5 text-sm font-semibold text-white disabled:opacity-50 lg:h-11"
          >
            Listo
          </button>
          {otroValido && (
            <p className="m-0 w-full text-xs text-muted">
              <span className="font-mono text-ink">{fmtHoras(duracion(inicio, fin))}</span>
              {fin < inicio && ' · termina al día siguiente, cuenta como este día'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
