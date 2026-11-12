import { Check, ChevronDown, CircleCheckBig, Loader2, LockOpen, Moon, Sun, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageBody, PageHeader } from '../../components/PageHeader'
import { SelectorSemana } from '../../components/Selectores'
import { useToast } from '../../components/toast'
import { Button, EmptyState, Notice, Pill, Skeleton } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { useData } from '../../lib/data'
import { areaDeCierre, claveDivision, nombreDivision, todasLasDivisiones } from '../../lib/divisiones'
import { DIAS, DIAS_LETRA, diasDeSemana, fechaCorta, fechaLarga, indiceDia, jornadaActual, lunesDe, numeroDia } from '../../lib/fechas'
import { useLocal, useLocalId } from '../../lib/local'
import { horasReales, useSemana } from '../../lib/semana'
import { supabase } from '../../lib/supabase'
import { fmtHoras } from '../../lib/time'
import type { Asignacion, CierreDivision, Division, Empleado } from '../../lib/types'
import { Dato, ESTADO_PILL, EstadoIcono, EstadoMini, FilaCierre, horaDe, ordenEntrada, sinUnidad, type Estado } from './piezas'

type Div = {
  clave: string
  division: Division
  nombre: string
  turnos: Asignacion[]
  estado: Estado
  cierre: CierreDivision | undefined
  mia: boolean
  personas: number
  presentes: number
  plan: number
  reales: number
}

const sumar = (turnos: Asignacion[]) => ({
  personas: new Set(turnos.map((a) => a.empleado_id)).size,
  presentes: new Set(turnos.filter((a) => !a.ausente).map((a) => a.empleado_id)).size,
  plan: turnos.reduce((s, a) => s + Number(a.horas_plan), 0),
  reales: turnos.reduce((s, a) => s + horasReales(a), 0),
})

/** Estado del día mirando solo las divisiones que importan (las del encargado, o todas para el admin). */
function estadoDia(divs: Div[]): Estado {
  if (divs.length === 0) return 'sin'
  if (divs.every((d) => d.estado === 'confirmado')) return 'confirmado'
  if (divs.some((d) => d.estado === 'pendiente')) return 'pendiente'
  return 'futuro'
}

export function CierrePage() {
  const localId = useLocalId()
  const { esAdmin, puedoCerrar } = useLocal()
  const { session } = useAuth()
  const { areas, empleados, loading: cargandoDatos, error: errorDatos } = useData()
  const toast = useToast()

  const hoy = jornadaActual()
  const [lunes, setLunes] = useState(() => lunesDe(hoy))
  const [dia, setDia] = useState(hoy)
  const semana = useSemana(localId, lunes)
  const dias = diasDeSemana(lunes)
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set())
  const [nombres, setNombres] = useState<Map<string, string>>(new Map())

  // El admin ve quién confirmó cada división
  useEffect(() => {
    if (!esAdmin || !supabase) return
    supabase
      .from('miembros')
      .select('usuario_id, nombre, email')
      .eq('local_id', localId)
      .then(({ data }) => setNombres(new Map((data ?? []).map((m) => [m.usuario_id as string, ((m.nombre as string) || (m.email as string) || '').split(' ')[0]]))))
  }, [esAdmin, localId])

  const empPorId = useMemo(() => new Map(empleados.map((e) => [e.id, e])), [empleados])
  const divisiones = useMemo(() => todasLasDivisiones(areas), [areas])

  const semanaDivs = useMemo(
    () =>
      dias.map((fecha) => {
        const delDia = semana.asignaciones.filter((a) => a.fecha_jornada === fecha)
        const divs: Div[] = divisiones
          .map((division) => {
            const turnos = delDia
              .filter((a) => areaDeCierre(areas, empPorId.get(a.empleado_id)?.area_id) === division.area_id && a.momento === division.momento)
              .sort((a, b) => ordenEntrada(a) - ordenEntrada(b) || (empPorId.get(a.empleado_id)?.nombre ?? '').localeCompare(empPorId.get(b.empleado_id)?.nombre ?? ''))
            const cierre = semana.cierres.find((c) => c.fecha === fecha && c.area_id === division.area_id && c.momento === division.momento)
            const estado: Estado = cierre?.confirmado ? 'confirmado' : fecha > hoy ? 'futuro' : 'pendiente'
            return {
              clave: claveDivision(division),
              division,
              nombre: nombreDivision(areas, division),
              turnos,
              estado,
              cierre,
              mia: puedoCerrar(division.area_id, division.momento),
              ...sumar(turnos),
            }
          })
          .filter((d) => d.turnos.length > 0)
        // Primero las propias
        divs.sort((a, b) => Number(b.mia) - Number(a.mia))
        const relevantes = esAdmin ? divs : divs.filter((d) => d.mia)
        return { fecha, divs, relevantes, estado: estadoDia(relevantes), ...sumar(delDia) }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [semana.asignaciones, semana.cierres, lunes, hoy, empPorId, divisiones, areas, esAdmin, puedoCerrar],
  )
  const actual = semanaDivs.find((d) => d.fecha === dia) ?? semanaDivs[0]

  const irASemana = (l: string) => {
    setLunes(l)
    setDia(l === lunesDe(hoy) ? hoy : l)
  }

  const avisarError = (ok: boolean) => {
    if (!ok) toast.show('No se pudo guardar. Revisá la conexión, o puede que otro encargado haya confirmado.', { tone: 'error' })
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

  const confirmar = (d: Div) => {
    const { fecha } = actual
    const { area_id, momento } = d.division
    semana.confirmarDivision(fecha, area_id, momento, true).then(avisarError)
    toast.show(`${d.nombre} · ${fechaCorta(fecha)} confirmado (${fmtHoras(d.reales)})`, {
      action: { label: 'Deshacer', onClick: () => semana.confirmarDivision(fecha, area_id, momento, false).then(avisarError) },
    })
  }

  const reabrir = (d: Div) => {
    semana.confirmarDivision(actual.fecha, d.division.area_id, d.division.momento, false).then(avisarError)
    toast.show(`${d.nombre} reabierto: ya podés corregir horas`)
  }

  const quien = (c: CierreDivision | undefined) => {
    if (!c?.confirmado) return null
    const hora = c.confirmado_en ? `a las ${horaDe(c.confirmado_en)}` : ''
    const por = c.confirmado_por === session?.user.id ? 'vos' : c.confirmado_por ? nombres.get(c.confirmado_por) : null
    return [hora, por ? `por ${por}` : ''].filter(Boolean).join(' ')
  }

  const cargando = cargandoDatos || semana.loading
  const errorCarga = errorDatos ?? semana.error
  const confirmadasHoy = actual.relevantes.filter((d) => d.estado === 'confirmado').length

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
          <SelectorSemana lunes={lunes} onChange={irASemana} hoy={hoy} />
          {(lunes !== lunesDe(hoy) || dia !== hoy) && (
            <Button variant="ghost" onClick={() => irASemana(lunesDe(hoy))} className="text-olive">
              Hoy
            </Button>
          )}
        </div>

        {/* Celular: tira de días con su estado */}
        <div className="grid grid-cols-7 gap-1.5 lg:hidden">
          {semanaDivs.map((r) => {
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
                <span className="text-[11px] text-muted">{esAdmin ? 'Todas las divisiones' : 'Tus divisiones'}</span>
              </div>
              <ul className="m-0 flex list-none flex-col gap-0.5 p-1.5">
                {semanaDivs.map((r) => {
                  const on = r.fecha === dia
                  const listas = r.relevantes.filter((d) => d.estado === 'confirmado').length
                  return (
                    <li key={r.fecha}>
                      <button
                        type="button"
                        onClick={() => setDia(r.fecha)}
                        aria-pressed={on}
                        className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${on ? 'bg-olive-soft' : 'hover:bg-hover active:bg-press'}`}
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
                            {r.relevantes.length === 0 ? '—' : `${listas}/${r.relevantes.length} confirmadas · ${fmtHoras(r.relevantes.reduce((s, d) => s + d.reales, 0))}`}
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
                  </div>
                  {actual.relevantes.length > 0 && (
                    <span className="text-[12px] text-muted">
                      {confirmadasHoy} de {actual.relevantes.length} {esAdmin ? 'divisiones confirmadas' : actual.relevantes.length === 1 ? 'confirmada' : 'confirmadas'}
                    </span>
                  )}
                </div>
                <dl className="m-0 mt-4 grid grid-cols-3 gap-2 lg:max-w-[560px]">
                  <Dato titulo="Trabajaron" valor={`${actual.presentes}/${actual.personas}`} />
                  <Dato titulo="Horas reales" valor={sinUnidad(actual.reales)} unidad="h" destacado={actual.reales !== actual.plan} />
                  <Dato titulo="Planificadas" valor={sinUnidad(actual.plan)} unidad="h" />
                </dl>
                {actual.divs.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {actual.divs.map((d) => (
                      <span
                        key={d.clave}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium ${
                          d.estado === 'confirmado' ? 'border-tarde-bd bg-tarde-bg text-tarde-fg' : d.estado === 'pendiente' ? 'border-warn-line bg-warn-soft text-warn' : 'border-line bg-foot text-muted'
                        }`}
                      >
                        {d.division.momento === 'noche' ? <Moon size={12} aria-hidden="true" /> : <Sun size={12} aria-hidden="true" />}
                        {d.nombre}
                        {d.estado === 'confirmado' && <Check size={12} strokeWidth={2.6} aria-label="confirmada" />}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              {actual.estado === 'futuro' && actual.relevantes.length > 0 && (
                <Notice tone="info">Este día todavía no llegó. Vas a poder corregir horas y confirmarlo a partir del {fechaLarga(actual.fecha).toLowerCase()}.</Notice>
              )}
              {!esAdmin && actual.divs.length > 0 && actual.relevantes.length === 0 && (
                <Notice tone="info">Este día no hay turnos en tu división. Abajo podés ver cómo van las demás.</Notice>
              )}

              {actual.divs.length === 0 ? (
                <EmptyState
                  icon={<Users size={22} />}
                  title="Nadie tenía turno este día"
                  description="Cuando haya turnos cargados en Horarios, acá se confirma quién vino y cuántas horas hizo."
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
                actual.divs.map((d) => {
                  // Las divisiones ajenas arrancan plegadas para el encargado
                  const plegable = !d.mia
                  const abierta = !plegable || abiertas.has(d.clave)
                  const editable = d.mia && d.estado === 'pendiente'
                  const detalle = quien(d.cierre)
                  return (
                    <section key={d.clave} aria-label={d.nombre} className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
                      <header
                        className={`flex items-center gap-3 border-line bg-head px-4 py-3 lg:px-5 ${abierta ? 'border-b' : ''} ${plegable ? 'cursor-pointer transition-colors hover:bg-hover' : ''}`}
                        onClick={
                          plegable
                            ? () =>
                                setAbiertas((s) => {
                                  const n = new Set(s)
                                  if (n.has(d.clave)) n.delete(d.clave)
                                  else n.add(d.clave)
                                  return n
                                })
                            : undefined
                        }
                      >
                        <span
                          aria-hidden="true"
                          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${d.division.momento === 'noche' ? 'bg-[#3A4431] text-[#E8EEDF]' : 'bg-warn-soft text-warn'}`}
                        >
                          {d.division.momento === 'noche' ? <Moon size={16} /> : <Sun size={16} />}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex flex-wrap items-center gap-2">
                            <h3 className="m-0 text-[15px] font-semibold">{d.nombre}</h3>
                            <Pill {...ESTADO_PILL[d.estado].tono}>
                              {d.estado === 'confirmado' && <Check size={11} strokeWidth={2.6} aria-hidden="true" />}
                              {ESTADO_PILL[d.estado].label}
                            </Pill>
                          </span>
                          <span className="truncate text-[12px] text-muted">
                            {d.presentes}/{d.personas} {d.personas === 1 ? 'persona' : 'personas'} · <span className="font-mono">{fmtHoras(d.reales)}</span>
                            {detalle && ` · ${detalle}`}
                            {!d.mia && !esAdmin && d.estado === 'pendiente' && ' · la confirma su encargado'}
                          </span>
                        </div>
                        {plegable && (
                          <button
                            type="button"
                            aria-expanded={abierta}
                            aria-label={abierta ? `Ocultar ${d.nombre}` : `Ver ${d.nombre}`}
                            className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-press hover:text-ink"
                          >
                            <ChevronDown size={18} className={`transition-transform duration-200 ${abierta ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                      </header>

                      {abierta && (
                        <>
                          <ul className="m-0 list-none p-0">
                            {d.turnos.map((a, i) => {
                              const emp = empPorId.get(a.empleado_id)
                              return (
                                <FilaCierre
                                  key={a.id}
                                  a={a}
                                  emp={emp}
                                  segundo={d.turnos.findIndex((x) => x.empleado_id === a.empleado_id) < i}
                                  editable={editable && !a.id.startsWith('tmp-')}
                                  onHoras={(h) => cambiarHoras(a, h)}
                                  onAusente={(v) => cambiarAusente(a, emp, v)}
                                />
                              )
                            })}
                          </ul>
                          {d.mia && (d.estado === 'pendiente' || d.estado === 'confirmado') && (
                            <div className="flex flex-col gap-2 border-t border-line bg-foot px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-5">
                              <span className="text-[12px] text-muted max-sm:hidden">
                                {d.estado === 'pendiente' ? 'Revisá las horas y confirmá cuando esté todo bien.' : 'Para corregir algo, reabrila.'}
                              </span>
                              {d.estado === 'confirmado' ? (
                                <Button onClick={() => reabrir(d)} icon={<LockOpen size={16} />} className="max-sm:w-full">
                                  Reabrir {d.nombre}
                                </Button>
                              ) : (
                                <Button variant="primary" onClick={() => confirmar(d)} icon={<CircleCheckBig size={17} />} className="max-sm:h-12 max-sm:w-full">
                                  Confirmar {d.nombre}
                                  <span className="font-mono text-[13px] font-medium opacity-80">· {fmtHoras(d.reales)}</span>
                                </Button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </section>
                  )
                })
              )}
            </div>
          </div>
        )}
      </PageBody>
    </>
  )
}
