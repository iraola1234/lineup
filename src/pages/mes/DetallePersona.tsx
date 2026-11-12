import { Avatar, Pill, Sheet, pillDanger } from '../../components/ui'
import { turnoColor } from '../../lib/colors'
import { fechaCorta } from '../../lib/fechas'
import { horasReales } from '../../lib/semana'
import { fmtHoras } from '../../lib/time'
import { rango } from '../semana/helpers'
import type { FilaPersona, ResumenMes } from './calculo'

const sinUnidad = (h: number) => fmtHoras(h).replace(' h', '')

/** El mes de una persona, día por día. */
export function DetallePersona({ persona, resumen, onClose }: { persona: FilaPersona | null; resumen: ResumenMes | null; onClose: () => void }) {
  const estadoDe = new Map(resumen?.dias.map((d) => [d.fecha, d.estado]) ?? [])
  const turnos = persona ? [...persona.turnos].sort((a, b) => a.fecha_jornada.localeCompare(b.fecha_jornada) || a.inicio_plan.localeCompare(b.inicio_plan)) : []

  return (
    <Sheet
      open={!!persona}
      onClose={onClose}
      autoFocus={false}
      title={persona?.emp.nombre ?? ''}
      subtitle={persona ? [persona.emp.puesto, persona.area?.nombre].filter(Boolean).join(' · ') : undefined}
      leading={persona ? <Avatar nombre={persona.emp.nombre} size={40} /> : undefined}
    >
      {persona && (
        <div className="flex flex-col gap-4">
          <dl className="m-0 grid grid-cols-3 gap-2">
            <Dato titulo="Horas reales" valor={sinUnidad(persona.reales)} detalle={`plan ${sinUnidad(persona.plan)}`} />
            <Dato titulo="Días" valor={String(persona.dias)} detalle={persona.ausencias ? `${persona.ausencias} ausencia${persona.ausencias > 1 ? 's' : ''}` : 'sin ausencias'} alerta={persona.ausencias > 0} />
            <Dato titulo="Diferencia" valor={persona.reales === persona.plan ? '0' : `${persona.reales > persona.plan ? '+' : '−'}${sinUnidad(Math.abs(persona.reales - persona.plan))}`} detalle="real vs. plan" alerta={persona.reales < persona.plan} />
          </dl>

          <div className="overflow-hidden rounded-2xl border border-line">
            <ul className="m-0 list-none p-0">
              {turnos.map((a, i) => {
                const primero = i === 0 || turnos[i - 1].fecha_jornada !== a.fecha_jornada
                const h = horasReales(a)
                const corregido = !a.ausente && a.horas_reales !== null && Number(a.horas_reales) !== Number(a.horas_plan)
                const pendiente = !!resumen && !resumen.confirmado(a) && estadoDe.get(a.fecha_jornada) !== 'futuro'
                const c = turnoColor(a.color)
                return (
                  <li key={a.id} className={`flex items-center gap-3 px-3.5 py-2.5 ${primero && i > 0 ? 'border-t border-divider' : ''} ${a.ausente ? 'bg-[#FCF8F7]' : ''}`}>
                    <span className={`w-14 shrink-0 text-[13px] font-semibold ${primero ? '' : 'invisible'}`}>{fechaCorta(a.fecha_jornada)}</span>
                    <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px]">
                      <span aria-hidden="true" className="size-2 shrink-0 rounded-full border" style={{ background: c.bg, borderColor: c.bd }} />
                      <span className="truncate text-ink-2">
                        {a.nombre_turno} <span className="font-mono text-muted">{rango(a)}</span>
                      </span>
                      {pendiente && <span className="shrink-0 text-[11px] text-warn">· sin cerrar</span>}
                    </span>
                    {a.ausente ? (
                      <Pill {...pillDanger}>Ausente</Pill>
                    ) : (
                      <span className="flex shrink-0 flex-col items-end">
                        <span className={`font-mono text-[13px] font-semibold tabular-nums ${corregido ? 'text-olive' : ''}`}>{fmtHoras(h)}</span>
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
    </Sheet>
  )
}

function Dato({ titulo, valor, detalle, alerta = false }: { titulo: string; valor: string; detalle: string; alerta?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-foot px-3 py-2.5">
      <dt className="text-[11px] font-medium text-muted">{titulo}</dt>
      <dd className="m-0 flex flex-col gap-0.5">
        <span className="font-mono text-[18px] leading-none font-semibold tracking-tight">{valor}</span>
        <span className={`text-[11px] ${alerta ? 'font-medium text-danger' : 'text-muted'}`}>{detalle}</span>
      </dd>
    </div>
  )
}
