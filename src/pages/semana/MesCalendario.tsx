import { TreePalm, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Select, Skeleton } from '../../components/ui'
import { LIBRE, turnoColor } from '../../lib/colors'
import { DIAS_ABR, DIAS_LETRA, addDays, fechaLarga, lunesDe, numeroDia } from '../../lib/fechas'
import { limitesMes, type DatosMes } from '../../lib/mes'
import { horasReales } from '../../lib/semana'
import { fmtHoras } from '../../lib/time'
import type { Asignacion, Empleado } from '../../lib/types'
import type { Grupo } from './helpers'
import { rango } from './helpers'

type Props = {
  mes: string
  hoy: string
  datos: DatosMes | null
  grupos: Grupo[]
  desktop: boolean
  /** Ir a un día (abre la vista del día). */
  onDia: (fecha: string) => void
}

/** Calendario mensual de horarios: todo el equipo o una persona. Tocar un día lo abre. */
export function MesCalendario({ mes, hoy, datos, grupos, desktop, onDia }: Props) {
  const [persona, setPersona] = useState('')
  const { desde, hasta } = limitesMes(mes)
  const empleados = useMemo(() => grupos.flatMap((g) => g.empleados), [grupos])
  const emp = empleados.find((e) => e.id === persona) ?? null

  const semanas = useMemo(() => {
    const out: string[][] = []
    for (let l = lunesDe(desde); l <= hasta; l = addDays(l, 7)) out.push(Array.from({ length: 7 }, (_, i) => addDays(l, i)))
    return out
  }, [desde, hasta])

  const { porDia, marcados } = useMemo(() => {
    const porDia = new Map<string, Asignacion[]>()
    for (const a of [...(datos?.asignaciones ?? [])].sort((x, y) => x.inicio_plan.localeCompare(y.inicio_plan)))
      porDia.set(a.fecha_jornada, [...(porDia.get(a.fecha_jornada) ?? []), a])
    const marcados = new Map<string, Set<string>>()
    for (const l of datos?.libres ?? []) marcados.set(l.fecha, new Set([...(marcados.get(l.fecha) ?? []), l.empleado_id]))
    return { porDia, marcados }
  }, [datos])

  // Resumen de la persona elegida (hasta hoy los libres; el resto, todo el mes)
  const resumen = useMemo(() => {
    if (!emp) return null
    let dias = 0
    let horas = 0
    let libres = 0
    let programados = 0
    for (let f = desde; f <= hasta; f = addDays(f, 1)) {
      const suyos = (porDia.get(f) ?? []).filter((a) => a.empleado_id === emp.id)
      if (suyos.some((a) => !a.ausente)) dias++
      horas += suyos.reduce((s, a) => s + horasReales(a), 0)
      const marcado = marcados.get(f)?.has(emp.id) ?? false
      if (suyos.length === 0 && f <= hoy && ((porDia.get(f)?.length ?? 0) > 0 || marcado)) libres++
      if (suyos.length === 0 && f > hoy && marcado) programados++
    }
    return { dias, horas, libres, programados }
  }, [emp, desde, hasta, porDia, marcados, hoy])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={persona} onChange={(e) => setPersona(e.target.value)} aria-label="Ver el mes de" className="w-full sm:w-64">
          <option value="">Todo el equipo</option>
          {grupos.map((g) => (
            <optgroup key={g.area.id} label={g.area.nombre}>
              {g.empleados.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
        {resumen && (
          <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
            <span className="rounded-full border border-line bg-card px-3 py-1.5 shadow-xs">
              <span className="font-mono font-semibold">{resumen.dias}</span> días · <span className="font-mono">{fmtHoras(resumen.horas)}</span>
            </span>
            <span
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5"
              style={{ background: LIBRE.bg, color: LIBRE.fg, borderColor: LIBRE.bd }}
            >
              <TreePalm size={13} aria-hidden="true" />
              <span className="font-mono font-semibold">{resumen.libres}</span> {resumen.libres === 1 ? 'libre' : 'libres'}
              {resumen.programados > 0 && <span className="opacity-75">· +{resumen.programados} marcados</span>}
            </span>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
        <div className="grid grid-cols-7 border-b border-line bg-head">
          {DIAS_ABR.map((d, i) => (
            <div key={d} className="py-2 text-center text-[11px] font-medium text-muted">
              <span className="max-sm:hidden">{d}</span>
              <span className="sm:hidden">{DIAS_LETRA[i]}</span>
            </div>
          ))}
        </div>
        {!datos ? (
          <div className="grid grid-cols-7 gap-px bg-divider" aria-busy="true" aria-label="Cargando">
            {Array.from({ length: 35 }, (_, i) => (
              <div key={i} className="h-20 bg-card p-2 lg:h-28">
                <Skeleton className="h-3 w-5" />
              </div>
            ))}
          </div>
        ) : (
          semanas.map((sem) => (
            <div key={sem[0]} className="grid grid-cols-7 border-b border-divider last:border-b-0">
              {sem.map((f, i) => {
                const fuera = f < desde || f > hasta
                const turnos = porDia.get(f) ?? []
                const libresDia = marcados.get(f) ?? new Set<string>()
                return (
                  <Celda
                    key={f}
                    fecha={f}
                    fuera={fuera}
                    hoy={f === hoy}
                    borde={i > 0}
                    desktop={desktop}
                    turnos={turnos}
                    libresMarcados={libresDia}
                    emp={emp}
                    empleados={empleados}
                    onClick={() => onDia(f)}
                  />
                )
              })}
            </div>
          ))
        )}
      </div>
      <p className="m-0 text-xs text-faint">
        {desktop ? 'Hacé clic' : 'Tocá'} un día para verlo y editarlo. Un día sin turno cuenta como libre; los marcados como “Día libre” se ven en celeste.
      </p>
    </div>
  )
}

function Celda({
  fecha,
  fuera,
  hoy,
  borde,
  desktop,
  turnos,
  libresMarcados,
  emp,
  empleados,
  onClick,
}: {
  fecha: string
  fuera: boolean
  hoy: boolean
  borde: boolean
  desktop: boolean
  turnos: Asignacion[]
  libresMarcados: Set<string>
  emp: Empleado | null
  empleados: Empleado[]
  onClick: () => void
}) {
  const base = `relative flex min-h-20 flex-col items-stretch gap-1 p-1.5 text-left transition-colors lg:min-h-28 lg:p-2 ${borde ? 'border-l border-divider' : ''}`
  if (fuera) return <div className={`${base} bg-foot/60`} aria-hidden="true" />

  const numero = (
    <span
      className={`flex size-6 items-center justify-center self-start rounded-full font-mono text-[12px] font-semibold ${hoy ? 'bg-olive text-white' : 'text-ink'}`}
    >
      {numeroDia(fecha)}
    </span>
  )

  // Una persona
  if (emp) {
    const suyos = turnos.filter((a) => a.empleado_id === emp.id)
    const marcado = libresMarcados.has(emp.id)
    const sinTurnoConHorarios = suyos.length === 0 && turnos.length > 0
    const texto = suyos.length
      ? suyos.map((a) => `${a.nombre_turno} ${rango(a)}`).join(', ')
      : marcado
        ? 'día libre'
        : sinTurnoConHorarios
          ? 'libre'
          : 'sin horarios'
    return (
      <button type="button" onClick={onClick} aria-label={`${fechaLarga(fecha)}: ${texto}`} className={`${base} hover:bg-hover active:bg-press`}>
        {numero}
        {suyos.map((a) => {
          const c = turnoColor(a.color)
          return (
            <span
              key={a.id}
              className="truncate rounded-md border px-1 py-0.5 font-mono text-[10px] font-semibold lg:px-1.5 lg:text-[11px]"
              style={a.ausente ? { background: '#FFFFFF', color: '#A33A2C', borderColor: '#F0C6BE' } : { background: c.bg, color: c.fg, borderColor: c.bd }}
            >
              {a.ausente ? 'Ausente' : desktop ? rango(a) : a.inicio_plan.slice(0, 5)}
            </span>
          )
        })}
        {suyos.length === 0 && marcado && (
          <span
            className="flex items-center gap-1 truncate rounded-md border px-1 py-0.5 text-[10px] font-semibold lg:px-1.5 lg:text-[11px]"
            style={{ background: LIBRE.bg, color: LIBRE.fg, borderColor: LIBRE.bd }}
          >
            <TreePalm size={11} aria-hidden="true" className="shrink-0 max-sm:hidden" />
            Libre
          </span>
        )}
        {sinTurnoConHorarios && !marcado && <span className="px-1 text-[10px] text-faint lg:text-[11px]">Libre</span>}
      </button>
    )
  }

  // Todo el equipo
  const trabajan = new Set(turnos.filter((a) => !a.ausente).map((a) => a.empleado_id)).size
  const porTipo = new Map<string, { nombre: string; color: string; n: number }>()
  for (const a of turnos) {
    if (a.ausente) continue
    const k = `${a.nombre_turno}|${a.color}`
    const t = porTipo.get(k) ?? { nombre: a.nombre_turno, color: a.color, n: 0 }
    t.n++
    porTipo.set(k, t)
  }
  const tipos = [...porTipo.values()].sort((x, y) => y.n - x.n)
  const nombresLibres = empleados.filter((e) => libresMarcados.has(e.id)).map((e) => e.nombre.split(' ')[0])
  const visibles = desktop ? 3 : 0

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${fechaLarga(fecha)}: ${trabajan} personas${nombresLibres.length ? `, ${nombresLibres.length} con día libre` : ''}`}
      title={nombresLibres.length ? `Día libre: ${nombresLibres.join(', ')}` : undefined}
      className={`${base} hover:bg-hover active:bg-press`}
    >
      <span className="flex items-center justify-between gap-1">
        {numero}
        {trabajan > 0 && (
          <span className="flex items-center gap-0.5 font-mono text-[10px] text-muted lg:text-[11px]">
            <Users size={10} aria-hidden="true" className="max-sm:hidden" />
            {trabajan}
          </span>
        )}
      </span>
      {desktop ? (
        <>
          {tipos.slice(0, visibles).map((t) => {
            const c = turnoColor(t.color)
            return (
              <span
                key={`${t.nombre}|${t.color}`}
                className="flex items-center justify-between gap-1 truncate rounded-md border px-1.5 py-0.5 text-[11px] font-medium"
                style={{ background: c.bg, color: c.fg, borderColor: c.bd }}
              >
                <span className="truncate">{t.nombre}</span>
                <span className="font-mono font-semibold">{t.n}</span>
              </span>
            )
          })}
          {tipos.length > visibles && <span className="px-1 text-[11px] text-muted">+{tipos.length - visibles} más</span>}
        </>
      ) : (
        tipos.length > 0 && (
          <span className="flex flex-wrap gap-0.5 px-0.5">
            {tipos.slice(0, 6).map((t) => {
              const c = turnoColor(t.color)
              return (
                <span
                  key={`${t.nombre}|${t.color}`}
                  aria-hidden="true"
                  className="size-1.5 rounded-full border"
                  style={{ background: c.bd, borderColor: c.bd }}
                />
              )
            })}
          </span>
        )
      )}
      {nombresLibres.length > 0 && (
        <span
          className="mt-auto flex items-center gap-1 truncate rounded-md border px-1 py-0.5 text-[10px] font-medium lg:px-1.5 lg:text-[11px]"
          style={{ background: LIBRE.bg, color: LIBRE.fg, borderColor: LIBRE.bd }}
        >
          <TreePalm size={11} aria-hidden="true" className="shrink-0" />
          <span className="truncate">{desktop ? nombresLibres.join(', ') : nombresLibres.length}</span>
        </span>
      )}
    </button>
  )
}
