import { AlertTriangle, Check, CheckCheck, ChevronDown, Loader2, Wallet } from 'lucide-react'
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageBody, PageHeader } from '../../components/PageHeader'
import { SelectorSemana } from '../../components/Selectores'
import { useToast } from '../../components/toast'
import { Avatar, Button, ConfirmDialog, EmptyState, Notice, Skeleton } from '../../components/ui'
import { useData } from '../../lib/data'
import { areaDeCierre } from '../../lib/divisiones'
import { DIAS, DIAS_LETRA, addDays, diasDeSemana, indiceDia, jornadaActual, lunesDe, numeroDia } from '../../lib/fechas'
import { useLocal, useLocalId } from '../../lib/local'
import { fmtPesos, repartirPorDia, usePropinaSemana, type DiaPropina, type PagoPropina, type PersonaPropina } from '../../lib/propinas'
import { useSemana } from '../../lib/semana'
import { fmtHoras } from '../../lib/time'
import type { Empleado } from '../../lib/types'

type Fila = { emp: Empleado; pago: PagoPropina | undefined } & PersonaPropina

const fechaPago = (iso: string) => new Date(iso).toLocaleDateString('es-UY', { day: 'numeric', month: 'short' })

export function PropinasPage() {
  const localId = useLocalId()
  const { esAdmin } = useLocal()
  const { areas, empleados, loading: cargandoDatos } = useData()
  const toast = useToast()

  const hoy = jornadaActual()
  // Por defecto, la semana que terminó (la que toca pagar); los lunes y martes también suele ser esa
  const [lunes, setLunes] = useState(() => addDays(lunesDe(hoy), -7))
  const semana = useSemana(localId, lunes)
  const dias = diasDeSemana(lunes)
  const propina = usePropinaSemana(localId, lunes, dias[6])
  const [pagarTodos, setPagarTodos] = useState(false)
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())

  const empPorId = useMemo(() => new Map(empleados.map((e) => [e.id, e])), [empleados])
  const reparto = useMemo(
    () => repartirPorDia(dias, propina.montos, semana.asignaciones, (id) => empPorId.get(id)?.participa_propina ?? false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lunes, propina.montos, semana.asignaciones, empPorId],
  )

  const ordenArea = new Map(areas.map((a, i) => [a.id, i]))
  const filas: Fila[] = [...reparto.personas]
    .map(([id, r]) => ({ emp: empPorId.get(id)!, ...r, pago: propina.pagos.find((p) => p.empleado_id === id) }))
    .filter((f) => f.emp)
    .sort((a, b) => (ordenArea.get(a.emp.area_id) ?? 99) - (ordenArea.get(b.emp.area_id) ?? 99) || a.emp.nombre.localeCompare(b.emp.nombre))
  // Pagos de gente que ya no tiene horas esa semana (por correcciones posteriores)
  const pagosHuerfanos = propina.pagos.filter((p) => !reparto.personas.has(p.empleado_id))
  const noParticipan = [...new Set(semana.asignaciones.map((a) => a.empleado_id))]
    .map((id) => empPorId.get(id))
    .filter((e): e is Empleado => !!e && !e.participa_propina)

  const pagado = propina.pagos.reduce((s, p) => s + p.monto, 0)
  const pendientes = filas.filter((f) => !f.pago && f.parte > 0)
  const conMonto = reparto.total > 0

  // ¿Quedan divisiones sin confirmar en días ya pasados?
  const sinConfirmar = useMemo(() => {
    const claves = new Set<string>()
    for (const a of semana.asignaciones) {
      if (a.fecha_jornada > hoy) continue
      const area = areaDeCierre(areas, empPorId.get(a.empleado_id)?.area_id)
      const ok = semana.cierres.some((c) => c.fecha === a.fecha_jornada && c.area_id === area && c.momento === a.momento && c.confirmado)
      if (!ok) claves.add(`${a.fecha_jornada}|${area}|${a.momento}`)
    }
    return claves.size
  }, [semana.asignaciones, semana.cierres, empPorId, hoy, areas])
  const semanaEnCurso = addDays(lunes, 6) >= hoy

  const guardarDia = async (fecha: string, n: number) => {
    const ok = await propina.guardarDia(fecha, n)
    if (!ok) toast.show('No se pudo guardar la propina. Probá de nuevo.', { tone: 'error' })
    return ok
  }

  const pagar = async (f: Fila) => {
    const ok = await propina.marcarPagados([{ empleado_id: f.emp.id, monto: f.parte }])
    if (!ok) return toast.show('No se pudo registrar el pago.', { tone: 'error' })
    toast.show(`${f.emp.nombre.split(' ')[0]}: ${fmtPesos(f.parte)} pagado`, {
      action: { label: 'Deshacer', onClick: () => propina.desmarcar([f.emp.id]) },
    })
  }

  const desmarcar = async (f: Fila) => {
    const pago = f.pago
    const ok = await propina.desmarcar([f.emp.id])
    if (!ok) return toast.show('No se pudo cambiar. Probá de nuevo.', { tone: 'error' })
    toast.show(`${f.emp.nombre.split(' ')[0]} vuelve a pendiente`, {
      action: pago ? { label: 'Deshacer', onClick: () => propina.marcarPagados([{ empleado_id: pago.empleado_id, monto: pago.monto }]) } : undefined,
    })
  }

  const pagarPendientes = async () => {
    const lista = pendientes.map((f) => ({ empleado_id: f.emp.id, monto: f.parte }))
    setPagarTodos(false)
    const ok = await propina.marcarPagados(lista)
    if (!ok) return toast.show('No se pudieron registrar los pagos.', { tone: 'error' })
    toast.show(`${lista.length} pagos registrados`, { action: { label: 'Deshacer', onClick: () => propina.desmarcar(lista.map((l) => l.empleado_id)) } })
  }

  const cargando = cargandoDatos || semana.loading || propina.loading
  const errorCarga = semana.error ?? propina.error

  return (
    <>
      <PageHeader title="Propinas" subtitle="Se carga por día, se reparte entre quienes trabajaron ese día y se paga por semana">
        <div className="flex items-center gap-1">
          <SelectorSemana lunes={lunes} onChange={setLunes} hoy={hoy} />
          {lunes !== addDays(lunesDe(hoy), -7) && (
            <Button variant="ghost" onClick={() => setLunes(addDays(lunesDe(hoy), -7))} className="text-olive">
              Última semana
            </Button>
          )}
        </div>
      </PageHeader>

      <PageBody>
        {errorCarga ? (
          <EmptyState
            icon={<Wallet size={22} />}
            title="No pudimos cargar las propinas"
            description={`${errorCarga} Revisá la conexión.`}
            action={
              <Button
                onClick={() => {
                  semana.reload()
                  propina.reload()
                }}
              >
                Reintentar
              </Button>
            }
          />
        ) : cargando ? (
          <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]" aria-busy="true" aria-label="Cargando">
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-6">
            {/* Propina de cada día */}
            <section
              aria-label="Propina de cada día"
              className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-card lg:sticky lg:top-6 lg:p-5"
            >
              <div className="flex items-baseline justify-between">
                <h2 className="m-0 text-[13px] font-medium text-muted">Propina de cada día</h2>
                {esAdmin && <span className="text-[11px] text-faint">Se guarda sola</span>}
              </div>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {reparto.dias.map((d) => (
                  <MontoDia
                    key={d.fecha}
                    dia={d}
                    hoy={hoy}
                    editable={esAdmin}
                    sinTurnos={!semana.asignaciones.some((a) => a.fecha_jornada === d.fecha)}
                    onGuardar={(n) => guardarDia(d.fecha, n)}
                  />
                ))}
              </ul>
              <div className="flex items-baseline justify-between border-t border-line pt-3">
                <span className="text-[13px] font-semibold">Total de la semana</span>
                <span className="font-mono text-[22px] leading-none font-semibold tracking-tight">{fmtPesos(reparto.total)}</span>
              </div>
              {reparto.sinRepartir > 0 && (
                <p className="m-0 flex items-start gap-1.5 text-xs text-warn">
                  <AlertTriangle size={13} className="mt-px shrink-0" aria-hidden="true" />
                  {fmtPesos(reparto.sinRepartir)} cargados en días sin horas trabajadas: no se pueden repartir.
                </p>
              )}

              {conMonto && filas.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between text-[13px]">
                    <span className="font-medium text-ink-2">
                      Pagado <span className="font-mono">{fmtPesos(pagado)}</span>
                    </span>
                    <span className="font-mono text-muted">
                      {filas.length - pendientes.length}/{filas.length}
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-foot"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={filas.length}
                    aria-valuenow={filas.length - pendientes.length}
                    aria-label="Personas pagadas"
                  >
                    <div
                      className="h-full rounded-full bg-olive transition-[width] duration-300"
                      style={{ width: `${((filas.length - pendientes.length) / filas.length) * 100}%` }}
                    />
                  </div>
                  {esAdmin && pendientes.length > 0 && (
                    <Button onClick={() => setPagarTodos(true)} icon={<CheckCheck size={16} />} className="mt-1">
                      Marcar todos como pagados
                    </Button>
                  )}
                </div>
              )}
            </section>

            <div className="flex min-w-0 flex-col gap-3">
              {(sinConfirmar > 0 || semanaEnCurso) && filas.length > 0 && (
                <Notice tone="info">
                  <span>
                    {semanaEnCurso ? 'La semana todavía no terminó. ' : ''}
                    {sinConfirmar > 0 && (
                      <>
                        {sinConfirmar === 1 ? 'Falta 1 cierre' : `Faltan ${sinConfirmar} cierres`} por confirmar en{' '}
                        <Link to="/cierre" className="font-semibold underline decoration-1 underline-offset-2 hover:no-underline">
                          Cierre
                        </Link>
                        .{' '}
                      </>
                    )}
                    Las horas pueden cambiar: conviene pagar cuando esté todo cerrado.
                  </span>
                </Notice>
              )}

              {filas.length === 0 ? (
                <EmptyState
                  icon={<Wallet size={22} />}
                  title="No hay horas trabajadas esta semana"
                  description="La propina de cada día se reparte entre quienes trabajaron ese día, según sus horas reales."
                />
              ) : (
                <section aria-label="Reparto por persona" className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
                  <div className="flex items-center justify-between border-b border-line bg-head px-4 py-2.5 lg:px-5">
                    <h3 className="m-0 text-[12px] font-semibold tracking-wide text-ink-2 uppercase">Reparto</h3>
                    <span className="text-[11px] text-muted">{filas.length} personas</span>
                  </div>
                  <ul className="m-0 list-none p-0">
                    {filas.map((f) => {
                      const diferencia = f.pago && Math.abs(f.pago.monto - f.parte) >= 1
                      const abierto = abiertos.has(f.emp.id)
                      return (
                        <li key={f.emp.id} className={`border-b border-divider last:border-b-0 ${f.pago ? 'bg-[#FAFBF7]' : ''}`}>
                          <div className="flex items-center gap-3 px-4 py-3 lg:px-5">
                            <button
                              type="button"
                              onClick={() =>
                                setAbiertos((s) => {
                                  const n = new Set(s)
                                  if (n.has(f.emp.id)) n.delete(f.emp.id)
                                  else n.add(f.emp.id)
                                  return n
                                })
                              }
                              aria-expanded={abierto}
                              aria-label={`${f.emp.nombre}: ver lo que le tocó cada día`}
                              className="-my-1 -ml-1.5 flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 pl-1.5 text-left transition-colors hover:bg-hover active:bg-press"
                            >
                              <Avatar nombre={f.emp.nombre} size={36} />
                              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="flex items-center gap-1 truncate text-sm font-semibold">
                                  {f.emp.nombre}
                                  <ChevronDown
                                    size={14}
                                    className={`shrink-0 text-faint transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}
                                    aria-hidden="true"
                                  />
                                </span>
                                <span className="truncate font-mono text-[12px] text-muted">
                                  {fmtHoras(f.horas)} · {f.porDia.size} {f.porDia.size === 1 ? 'día' : 'días'}
                                  {diferencia && (
                                    <span className="ml-1.5 inline-flex items-center gap-1 font-sans font-medium text-warn">
                                      <AlertTriangle size={11} aria-hidden="true" />
                                      se pagó {fmtPesos(f.pago!.monto)}
                                    </span>
                                  )}
                                </span>
                              </span>
                            </button>
                            <span className={`shrink-0 font-mono text-[15px] font-semibold ${conMonto ? 'text-money' : 'text-faint'}`}>
                              {conMonto ? fmtPesos(f.parte) : '—'}
                            </span>
                            {conMonto &&
                              (f.pago ? (
                                <button
                                  type="button"
                                  disabled={!esAdmin}
                                  onClick={() => desmarcar(f)}
                                  title={esAdmin ? 'Tocá para volver a pendiente' : undefined}
                                  aria-label={`${f.emp.nombre}: pagado el ${fechaPago(f.pago.pagado_en)}${esAdmin ? '. Volver a pendiente' : ''}`}
                                  className="flex h-9 w-[104px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-tarde-bd bg-tarde-bg text-[12px] font-semibold text-tarde-fg transition-colors enabled:hover:border-[#B9CAA2] enabled:hover:bg-[#DCE6CF] disabled:cursor-default"
                                >
                                  <Check size={14} strokeWidth={2.6} aria-hidden="true" />
                                  {fechaPago(f.pago.pagado_en)}
                                </button>
                              ) : esAdmin ? (
                                <Button size="sm" onClick={() => pagar(f)} className="w-[104px] shrink-0">
                                  Pagar
                                </Button>
                              ) : (
                                <span className="w-[104px] shrink-0 text-center text-[12px] font-medium text-warn">Pendiente</span>
                              ))}
                          </div>
                          {abierto && (
                            <div className="grid grid-cols-7 gap-1 px-4 pb-3 lg:px-5">
                              {reparto.dias.map((d) => {
                                const x = f.porDia.get(d.fecha)
                                return (
                                  <div
                                    key={d.fecha}
                                    className={`flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 ${x ? 'bg-foot' : 'opacity-45'}`}
                                    title={
                                      x ? `${DIAS[indiceDia(d.fecha)]}: ${fmtHoras(x.horas)} → ${fmtPesos(x.parte)}` : `${DIAS[indiceDia(d.fecha)]}: no trabajó`
                                    }
                                  >
                                    <span className="text-[10px] font-medium text-muted">
                                      {DIAS_LETRA[indiceDia(d.fecha)]} {numeroDia(d.fecha)}
                                    </span>
                                    <span className="font-mono text-[11px] font-semibold text-money">{x ? fmtPesos(x.parte) : '—'}</span>
                                    <span className="font-mono text-[10px] text-faint">{x ? fmtHoras(x.horas) : ''}</span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}

              {pagosHuerfanos.length > 0 && (
                <Notice tone="error">
                  Hay {pagosHuerfanos.length} pago(s) registrados a personas que ya no tienen horas esta semana:{' '}
                  {pagosHuerfanos.map((p) => `${empPorId.get(p.empleado_id)?.nombre ?? 'Persona'} (${fmtPesos(p.monto)})`).join(', ')}.
                </Notice>
              )}

              {noParticipan.length > 0 && (
                <p className="m-0 px-1 text-xs text-muted">
                  No participan de la propina: {noParticipan.map((e) => e.nombre).join(', ')}. Se cambia en la ficha de cada empleado.
                </p>
              )}
            </div>
          </div>
        )}
      </PageBody>

      <ConfirmDialog
        open={pagarTodos}
        title={`¿Marcar ${pendientes.length} pagos?`}
        message={`Se registra que se pagó a cada uno lo que le corresponde hoy (${fmtPesos(pendientes.reduce((s, f) => s + f.parte, 0))} en total).`}
        confirmLabel="Marcar como pagados"
        onConfirm={pagarPendientes}
        onCancel={() => setPagarTodos(false)}
      />
    </>
  )
}

const fmtValor = (n: number) => `$\u00A0${n.toLocaleString('es-UY', { maximumFractionDigits: 0 })}`
const leerMonto = (t: string) =>
  Number(
    t
      .replace(/[^\d,.]/g, '')
      .replace(/\./g, '')
      .replace(',', '.') || '0',
  )

/** Fila de un día: monto (editable por el admin) y cómo se reparte. */
function MontoDia({
  dia,
  hoy,
  editable,
  sinTurnos,
  onGuardar,
}: {
  dia: DiaPropina
  hoy: string
  editable: boolean
  /** Sin turnos ese día no hay a quién repartirle: no se carga (salvo que ya haya un monto, para poder borrarlo). */
  sinTurnos: boolean
  onGuardar: (n: number) => Promise<boolean>
}) {
  const bloqueado = sinTurnos && !(dia.monto > 0)
  const [texto, setTexto] = useState(dia.monto ? Math.round(dia.monto).toLocaleString('es-UY') : '')
  const [estado, setEstado] = useState<'quieto' | 'guardando' | 'ok'>('quieto')
  useEffect(() => {
    setTexto(dia.monto ? Math.round(dia.monto).toLocaleString('es-UY') : '')
  }, [dia.monto, dia.fecha])

  const guardar = async () => {
    const n = leerMonto(texto)
    if (!Number.isFinite(n) || n < 0 || Math.round(n) === Math.round(dia.monto)) return
    setEstado('guardando')
    const ok = await onGuardar(n)
    setEstado(ok ? 'ok' : 'quieto')
    if (ok) setTimeout(() => setEstado('quieto'), 1500)
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
  }
  const futuro = dia.fecha > hoy
  const detalle =
    dia.monto > 0 && dia.horas === 0
      ? 'nadie trabajó'
      : dia.horas > 0
        ? `${dia.personas} pers. · ${fmtHoras(dia.horas)}${dia.monto > 0 ? ` · ${fmtValor(dia.valorHora)}/h` : ''}`
        : sinTurnos
          ? 'sin turnos'
          : futuro
            ? ''
            : 'nadie que participe trabajó'

  return (
    <li className="flex items-center gap-3">
      <span className={`flex w-10 shrink-0 flex-col items-center leading-tight ${dia.fecha === hoy ? 'text-olive' : ''}`}>
        <span className="text-[10px] font-medium text-muted">{DIAS_LETRA[indiceDia(dia.fecha)]}</span>
        <span className="font-mono text-[15px] font-semibold">{numeroDia(dia.fecha)}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {editable ? (
          <label
            title={bloqueado ? 'Este día no tiene turnos cargados' : undefined}
            className={`flex h-10 items-center rounded-xl border transition-colors ${
              bloqueado
                ? 'cursor-not-allowed border-divider bg-foot'
                : 'border-line bg-card shadow-xs focus-within:border-olive focus-within:ring-2 focus-within:ring-olive/20 hover:border-line-strong'
            }`}
          >
            <span className="pl-3 font-mono text-sm text-muted">$</span>
            <input
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              aria-label={`Propina del ${DIAS[indiceDia(dia.fecha)].toLowerCase()} ${numeroDia(dia.fecha)}`}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              disabled={bloqueado}
              onBlur={guardar}
              onKeyDown={onKey}
              className="h-full min-w-0 flex-1 bg-transparent px-1.5 font-mono text-[15px] font-semibold outline-none disabled:cursor-not-allowed disabled:text-faint"
            />
            <span className="flex w-8 justify-center text-muted" aria-live="polite">
              {estado === 'guardando' && <Loader2 size={14} className="animate-spin" aria-label="Guardando" />}
              {estado === 'ok' && <Check size={15} strokeWidth={2.6} className="text-olive" aria-label="Guardado" />}
            </span>
          </label>
        ) : (
          <span className="font-mono text-[15px] font-semibold">{dia.monto > 0 ? fmtPesos(dia.monto) : '—'}</span>
        )}
        {detalle && <span className={`truncate font-mono text-[11px] ${dia.monto > 0 && dia.horas === 0 ? 'text-warn' : 'text-faint'}`}>{detalle}</span>}
      </span>
    </li>
  )
}
