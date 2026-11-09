import { Check, ChevronLeft, ChevronRight, CircleCheckBig, Loader2, LockOpen, Minus, Plus, RotateCcw, UserCheck, UserX, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageBody, PageHeader } from '../../components/PageHeader'
import { useToast } from '../../components/toast'
import { Avatar, Button, EmptyState, IconButton, Notice, Pill, Skeleton, pillDanger, pillNeutral, pillOk, pillWarn } from '../../components/ui'
import { turnoColor } from '../../lib/colors'
import { useData } from '../../lib/data'
import { DIAS, DIAS_LETRA, addDays, diasDeSemana, fechaCorta, fechaLarga, indiceDia, jornadaActual, lunesDe, numeroDia, rangoSemana } from '../../lib/fechas'
import { useLocalId } from '../../lib/local'
import { horasReales, useSemana } from '../../lib/semana'
import { fmtHoras, toHours } from '../../lib/time'
import type { Asignacion, Empleado } from '../../lib/types'
import { rango } from '../semana/helpers'

type Estado = 'sin' | 'futuro' | 'pendiente' | 'confirmado'

const ESTADO_PILL: Record<Estado, { label: string; tono: typeof pillOk }> = {
  sin: { label: 'Sin turnos', tono: pillNeutral },
  futuro: { label: 'Todavía no', tono: pillNeutral },
  pendiente: { label: 'Pendiente', tono: pillWarn },
  confirmado: { label: 'Confirmado', tono: pillOk },
}

/** Orden por hora de entrada, siguiendo el día de trabajo (05:00 → 04:59). */
const ordenEntrada = (a: Asignacion) => (toHours(a.inicio_plan) - 5 + 24) % 24
const sinUnidad = (h: number) => fmtHoras(h).replace(' h', '')
const horaDe = (iso: string) => new Date(iso).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', hour12: false })

export function CierrePage() {
  const localId = useLocalId()
  const { empleados, loading: cargandoDatos, error: errorDatos } = useData()
  const toast = useToast()

  const hoy = jornadaActual()
  const [lunes, setLunes] = useState(() => lunesDe(hoy))
  const [dia, setDia] = useState(hoy)
  const semana = useSemana(localId, lunes)
  const dias = diasDeSemana(lunes)

  const empPorId = useMemo(() => new Map(empleados.map((e) => [e.id, e])), [empleados])

  const resumen = useMemo(
    () =>
      dias.map((d) => {
        const turnos = semana.asignaciones
          .filter((a) => a.fecha_jornada === d)
          .sort((a, b) => ordenEntrada(a) - ordenEntrada(b) || (empPorId.get(a.empleado_id)?.nombre ?? '').localeCompare(empPorId.get(b.empleado_id)?.nombre ?? ''))
        const cierre = semana.cierres.find((c) => c.fecha === d)
        const estado: Estado = turnos.length === 0 ? 'sin' : cierre?.confirmado ? 'confirmado' : d > hoy ? 'futuro' : 'pendiente'
        const personas = new Set(turnos.map((a) => a.empleado_id))
        const presentes = new Set(turnos.filter((a) => !a.ausente).map((a) => a.empleado_id))
        return {
          fecha: d,
          turnos,
          estado,
          confirmadoEn: cierre?.confirmado ? (cierre.confirmado_en ?? null) : null,
          personas: personas.size,
          presentes: presentes.size,
          plan: turnos.reduce((s, a) => s + Number(a.horas_plan), 0),
          reales: turnos.reduce((s, a) => s + horasReales(a), 0),
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [semana.asignaciones, semana.cierres, lunes, hoy, empPorId],
  )
  const actual = resumen.find((r) => r.fecha === dia) ?? resumen[0]
  const editable = actual.estado === 'pendiente'
  const cerrados = resumen.filter((r) => r.estado === 'confirmado').length
  const aCerrar = resumen.filter((r) => r.estado === 'confirmado' || r.estado === 'pendiente').length

  const irASemana = (l: string) => {
    setLunes(l)
    setDia(l === lunesDe(hoy) ? hoy : l)
  }

  const avisarError = (ok: boolean) => {
    if (!ok) toast.show('No se pudo guardar. Revisá la conexión y probá de nuevo.', { tone: 'error' })
  }

  const cambiarHoras = (a: Asignacion, h: number) => {
    const v = Math.min(24, Math.max(0, Math.round(h * 2) / 2))
    semana.actualizar(a.id, { horas_reales: v === Number(a.horas_plan) ? null : v }).then(avisarError)
  }

  const cambiarAusente = (a: Asignacion, emp: Empleado | undefined, ausente: boolean) => {
    const nombre = (emp?.nombre ?? 'Persona').split(' ')[0]
    semana.actualizar(a.id, { ausente }).then(avisarError)
    toast.show(ausente ? `${nombre} quedó como ausente` : `${nombre} vuelve a contar como presente`, {
      action: { label: 'Deshacer', onClick: () => semana.actualizar(a.id, { ausente: !ausente }).then(avisarError) },
    })
  }

  const confirmar = () => {
    const fecha = actual.fecha
    semana.confirmarDia(fecha, true).then(avisarError)
    toast.show(`${fechaCorta(fecha)} confirmado · ${fmtHoras(actual.reales)}`, {
      action: { label: 'Deshacer', onClick: () => semana.confirmarDia(fecha, false).then(avisarError) },
    })
  }

  const reabrir = () => {
    const fecha = actual.fecha
    semana.confirmarDia(fecha, false).then(avisarError)
    toast.show(`${fechaCorta(fecha)} reabierto: ya podés corregir horas`)
  }

  const cargando = cargandoDatos || semana.loading
  const errorCarga = errorDatos ?? semana.error

  return (
    <>
      <PageHeader
        title="Cierre del día"
        subtitle={fechaLarga(dia)}
        actions={
          semana.guardando && (
            <span role="status" className="flex items-center gap-1.5 text-xs text-muted">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              <span className="max-sm:sr-only">Guardando…</span>
            </span>
          )
        }
      >
        <div className="flex items-center gap-1">
          <div className="flex items-center rounded-xl border border-line bg-card shadow-xs">
            <IconButton label="Semana anterior" onClick={() => irASemana(addDays(lunes, -7))} className="rounded-r-none">
              <ChevronLeft size={18} />
            </IconButton>
            <span className="min-w-[120px] border-x border-line px-2 text-center text-sm leading-[44px] font-semibold tabular-nums">{rangoSemana(lunes)}</span>
            <IconButton label="Semana siguiente" onClick={() => irASemana(addDays(lunes, 7))} className="rounded-l-none">
              <ChevronRight size={18} />
            </IconButton>
          </div>
          {(lunes !== lunesDe(hoy) || dia !== hoy) && (
            <Button variant="ghost" onClick={() => irASemana(lunesDe(hoy))} className="text-olive">
              Hoy
            </Button>
          )}
        </div>

        {/* Celular: tira de días con su estado */}
        <div className="grid grid-cols-7 gap-1.5 lg:hidden">
          {resumen.map((r) => {
            const on = r.fecha === dia
            return (
              <button
                key={r.fecha}
                type="button"
                onClick={() => setDia(r.fecha)}
                aria-pressed={on}
                aria-label={`${fechaLarga(r.fecha)}: ${ESTADO_PILL[r.estado].label}`}
                className={`relative flex h-[62px] flex-col items-center justify-center gap-0.5 rounded-2xl border transition-[background-color,border-color,transform] duration-150 active:scale-[0.95] ${
                  on ? 'border-olive bg-olive text-white shadow-xs' : 'border-line bg-card text-ink hover:border-line-strong hover:bg-hover'
                }`}
              >
                <span className={`text-[11px] font-medium ${on ? 'text-white/80' : r.fecha === hoy ? 'text-olive' : 'text-muted'}`}>{DIAS_LETRA[indiceDia(r.fecha)]}</span>
                <span className="font-mono text-base leading-none font-semibold">{numeroDia(r.fecha)}</span>
                <EstadoMini estado={r.estado} invertido={on} />
              </button>
            )
          })}
        </div>
      </PageHeader>

      <PageBody className="lg:pb-12">
        {errorCarga ? (
          <EmptyState
            icon={<CircleCheckBig size={22} />}
            title="No pudimos cargar el cierre"
            description={`${errorCarga} Revisá la conexión.`}
            action={<Button onClick={() => semana.reload()}>Reintentar</Button>}
          />
        ) : cargando ? (
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-9 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-9 w-32" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-6">
            {/* Computadora: la semana a la izquierda */}
            <aside aria-label="Días de la semana" className="hidden overflow-hidden rounded-2xl border border-line bg-card shadow-card lg:block">
              <div className="flex items-center justify-between border-b border-line bg-head px-4 py-3">
                <h2 className="m-0 text-[13px] font-semibold">Semana</h2>
                <span className="font-mono text-[11px] text-muted">
                  {cerrados}/{aCerrar} cerrados
                </span>
              </div>
              <ul className="m-0 flex list-none flex-col gap-0.5 p-1.5">
                {resumen.map((r) => {
                  const on = r.fecha === dia
                  return (
                    <li key={r.fecha}>
                      <button
                        type="button"
                        onClick={() => setDia(r.fecha)}
                        aria-pressed={on}
                        className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${
                          on ? 'bg-olive-soft' : 'hover:bg-hover active:bg-press'
                        }`}
                      >
                        <span
                          className={`flex size-10 shrink-0 flex-col items-center justify-center rounded-xl border leading-none ${
                            on ? 'border-olive bg-olive text-white' : 'border-line bg-card'
                          }`}
                        >
                          <span className={`text-[10px] font-medium ${on ? 'text-white/80' : r.fecha === hoy ? 'text-olive' : 'text-muted'}`}>
                            {DIAS_LETRA[indiceDia(r.fecha)]}
                          </span>
                          <span className="mt-0.5 font-mono text-[14px] font-semibold">{numeroDia(r.fecha)}</span>
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="text-[13px] font-semibold">
                            {DIAS[indiceDia(r.fecha)]}
                            {r.fecha === hoy && <span className="ml-1.5 text-[11px] font-medium text-olive">Hoy</span>}
                          </span>
                          <span className="font-mono text-[11px] text-muted">
                            {r.personas === 0 ? '—' : `${r.presentes} pers. · ${fmtHoras(r.reales)}`}
                          </span>
                        </span>
                        <EstadoIcono estado={r.estado} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </aside>

            <div className="flex min-w-0 flex-col gap-4">
              {/* Resumen del día */}
              <section aria-label="Resumen del día" className="rounded-2xl border border-line bg-card p-4 shadow-card lg:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h2 className="m-0 text-[15px] font-semibold lg:text-base">{fechaCorta(actual.fecha)}</h2>
                    <Pill {...ESTADO_PILL[actual.estado].tono}>
                      {actual.estado === 'confirmado' && <Check size={11} strokeWidth={2.6} aria-hidden="true" />}
                      {ESTADO_PILL[actual.estado].label}
                    </Pill>
                    {actual.confirmadoEn && <span className="font-mono text-[11px] text-muted">a las {horaDe(actual.confirmadoEn)}</span>}
                  </div>
                  <div className="hidden lg:block">
                    <AccionDia estado={actual.estado} horas={actual.reales} onConfirmar={confirmar} onReabrir={reabrir} />
                  </div>
                </div>
                <dl className="m-0 mt-4 grid grid-cols-3 gap-2 lg:max-w-[560px]">
                  <Dato titulo="Trabajaron" valor={`${actual.presentes}/${actual.personas}`} />
                  <Dato titulo="Horas reales" valor={sinUnidad(actual.reales)} unidad="h" destacado={actual.reales !== actual.plan} />
                  <Dato titulo="Planificadas" valor={sinUnidad(actual.plan)} unidad="h" />
                </dl>
              </section>

              {actual.estado === 'futuro' && (
                <Notice tone="info">Este día todavía no llegó. Vas a poder corregir horas y confirmarlo a partir del {fechaLarga(actual.fecha).toLowerCase()}.</Notice>
              )}
              {actual.estado === 'confirmado' && (
                <Notice tone="ok">Día cerrado. Para corregir algo, reabrilo. Si cambiás un turno desde Horarios, el día se reabre solo.</Notice>
              )}

              {actual.turnos.length === 0 ? (
                <EmptyState
                  icon={<Users size={22} />}
                  title="Nadie tenía turno este día"
                  description="Cuando cargues turnos en Horarios, acá vas a poder confirmar quién vino y cuántas horas hizo."
                  action={
                    <Link
                      to="/"
                      className="inline-flex h-11 items-center rounded-xl border border-line bg-card px-4 text-sm font-semibold shadow-xs transition-colors hover:border-line-strong hover:bg-hover active:bg-press"
                    >
                      Ir a Horarios
                    </Link>
                  }
                />
              ) : (
                <section aria-label="Quiénes trabajaron" className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
                  <div className="flex items-center justify-between border-b border-line bg-head px-4 py-2.5 lg:px-5">
                    <h3 className="m-0 text-[12px] font-semibold tracking-wide text-ink-2 uppercase">Por hora de entrada</h3>
                    <span className="text-[11px] text-muted max-sm:hidden">{editable ? 'Ajustá de a media hora' : ''}</span>
                  </div>
                  <ul className="m-0 list-none p-0">
                    {actual.turnos.map((a, i) => {
                      const emp = empPorId.get(a.empleado_id)
                      const repetido = actual.turnos.findIndex((x) => x.empleado_id === a.empleado_id) < i
                      return (
                        <FilaCierre
                          key={a.id}
                          a={a}
                          emp={emp}
                          segundo={repetido}
                          editable={editable && !a.id.startsWith('tmp-')}
                          onHoras={(h) => cambiarHoras(a, h)}
                          onAusente={(v) => cambiarAusente(a, emp, v)}
                        />
                      )
                    })}
                  </ul>
                </section>
              )}

              {/* Celular: acción fija abajo */}
              {(actual.estado === 'pendiente' || actual.estado === 'confirmado') && (
                <div className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-ground/95 px-4 pt-3 pb-3 backdrop-blur-md lg:hidden">
                  <AccionDia estado={actual.estado} horas={actual.reales} onConfirmar={confirmar} onReabrir={reabrir} ancho />
                </div>
              )}
            </div>
          </div>
        )}
      </PageBody>
    </>
  )
}

/* ---------- Piezas ---------- */

function AccionDia({
  estado,
  horas,
  onConfirmar,
  onReabrir,
  ancho = false,
}: {
  estado: Estado
  horas: number
  onConfirmar: () => void
  onReabrir: () => void
  ancho?: boolean
}) {
  if (estado === 'confirmado')
    return (
      <Button onClick={onReabrir} icon={<LockOpen size={16} />} className={ancho ? 'w-full' : ''}>
        Reabrir día
      </Button>
    )
  return (
    <Button
      variant="primary"
      size={ancho ? 'lg' : 'md'}
      onClick={onConfirmar}
      disabled={estado !== 'pendiente'}
      icon={<CircleCheckBig size={17} />}
      className={ancho ? 'w-full' : ''}
    >
      Confirmar día
      <span className="font-mono text-[13px] font-medium opacity-80">· {fmtHoras(horas)}</span>
    </Button>
  )
}

function Dato({ titulo, valor, unidad, destacado = false }: { titulo: string; valor: string; unidad?: string; destacado?: boolean }) {
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

function EstadoMini({ estado, invertido }: { estado: Estado; invertido: boolean }) {
  if (estado === 'confirmado')
    return (
      <span className={`flex size-3.5 items-center justify-center rounded-full ${invertido ? 'bg-white text-olive' : 'bg-olive text-white'}`}>
        <Check size={9} strokeWidth={3.2} aria-hidden="true" />
      </span>
    )
  if (estado === 'pendiente') return <span aria-hidden="true" className={`size-2 rounded-full ${invertido ? 'bg-[#F1D9AE]' : 'bg-[#D9A54A]'}`} />
  return <span aria-hidden="true" className={`h-0.5 w-2.5 rounded-full ${invertido ? 'bg-white/40' : 'bg-line-strong'}`} />
}

function EstadoIcono({ estado }: { estado: Estado }) {
  if (estado === 'confirmado')
    return (
      <span title="Confirmado" className="flex size-6 items-center justify-center rounded-full bg-olive text-white">
        <Check size={13} strokeWidth={3} aria-label="Confirmado" />
      </span>
    )
  if (estado === 'pendiente')
    return (
      <Pill {...pillWarn} className="!px-1.5 !text-[10px]">
        Pendiente
      </Pill>
    )
  return null
}

function FilaCierre({
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
