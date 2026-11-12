import { AlertTriangle, Check, CheckCheck, Pencil, Wallet } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageBody, PageHeader } from '../../components/PageHeader'
import { SelectorSemana } from '../../components/Selectores'
import { useToast } from '../../components/toast'
import { Avatar, Button, ConfirmDialog, EmptyState, Notice, Skeleton } from '../../components/ui'
import { useData } from '../../lib/data'
import { areaDeCierre } from '../../lib/divisiones'
import { addDays, jornadaActual, lunesDe } from '../../lib/fechas'
import { useLocal, useLocalId } from '../../lib/local'
import { fmtPesos, repartirSemana, usePropinaSemana, type PagoPropina } from '../../lib/propinas'
import { useSemana } from '../../lib/semana'
import { fmtHoras } from '../../lib/time'
import type { Empleado } from '../../lib/types'

type Fila = { emp: Empleado; horas: number; parte: number; pago: PagoPropina | undefined }

const fechaPago = (iso: string) => new Date(iso).toLocaleDateString('es-UY', { day: 'numeric', month: 'short' })
const fmtValorHora = (n: number) => `$ ${n.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function PropinasPage() {
  const localId = useLocalId()
  const { esAdmin } = useLocal()
  const { areas, empleados, loading: cargandoDatos } = useData()
  const toast = useToast()

  const hoy = jornadaActual()
  // Por defecto, la semana que terminó (la que toca pagar); los lunes y martes también suele ser esa
  const [lunes, setLunes] = useState(() => addDays(lunesDe(hoy), -7))
  const semana = useSemana(localId, lunes)
  const propina = usePropinaSemana(localId, lunes)
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [pagarTodos, setPagarTodos] = useState(false)

  useEffect(() => {
    setEditando(false)
  }, [lunes])

  const empPorId = useMemo(() => new Map(empleados.map((e) => [e.id, e])), [empleados])
  const reparto = useMemo(
    () => repartirSemana(propina.monto ?? 0, semana.asignaciones, (id) => empPorId.get(id)?.participa_propina ?? false),
    [propina.monto, semana.asignaciones, empPorId],
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
  const conMonto = (propina.monto ?? 0) > 0

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

  const empezarEdicion = () => {
    setTexto(propina.monto ? String(Math.round(propina.monto)) : '')
    setEditando(true)
  }

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    const n = Number(texto.replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.'))
    if (!Number.isFinite(n) || n < 0) return
    setGuardando(true)
    const ok = await propina.guardarMonto(n)
    setGuardando(false)
    if (!ok) return toast.show('No se pudo guardar el monto. Probá de nuevo.', { tone: 'error' })
    setEditando(false)
    toast.show(`Propina de la semana: ${fmtPesos(n)}`)
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
      <PageHeader title="Propinas" subtitle="Una por semana, repartida según las horas trabajadas">
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
            {/* Monto y resumen */}
            <section aria-label="Propina de la semana" className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4 shadow-card lg:sticky lg:top-6 lg:p-5">
              <div className="flex items-center justify-between">
                <h2 className="m-0 text-[13px] font-medium text-muted">Propina de la semana</h2>
                {esAdmin && conMonto && !editando && (
                  <Button size="sm" variant="ghost" onClick={empezarEdicion} icon={<Pencil size={14} />}>
                    Cambiar
                  </Button>
                )}
              </div>

              {editando || (esAdmin && !conMonto) ? (
                <form onSubmit={guardar} className="flex flex-col gap-2">
                  <label htmlFor="monto-propina" className="sr-only">
                    Monto total de la semana
                  </label>
                  <div className="flex items-center rounded-xl border border-line-strong bg-card shadow-xs focus-within:border-olive focus-within:ring-2 focus-within:ring-olive/20">
                    <span className="pl-3.5 font-mono text-xl font-semibold text-muted">$</span>
                    <input
                      id="monto-propina"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="0"
                      autoFocus={editando}
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      className="h-14 min-w-0 flex-1 bg-transparent px-2 font-mono text-[26px] font-semibold tracking-tight outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    {editando && (
                      <Button onClick={() => setEditando(false)} className="flex-1">
                        Cancelar
                      </Button>
                    )}
                    <Button type="submit" variant="primary" loading={guardando} disabled={texto.trim() === ''} className="flex-1">
                      Guardar monto
                    </Button>
                  </div>
                  {propina.pagos.length > 0 && <p className="m-0 text-xs text-warn">Ya hay pagos registrados: si cambiás el monto, revisá las diferencias.</p>}
                </form>
              ) : (
                <p className="m-0 font-mono text-[34px] leading-none font-semibold tracking-tight">{conMonto ? fmtPesos(propina.monto!) : '—'}</p>
              )}

              <dl className="m-0 grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1 rounded-xl bg-foot px-3 py-2.5">
                  <dt className="text-[11px] font-medium text-muted">Horas trabajadas</dt>
                  <dd className="m-0 font-mono text-[18px] leading-none font-semibold">{fmtHoras(reparto.horas)}</dd>
                </div>
                <div className="flex flex-col gap-1 rounded-xl bg-foot px-3 py-2.5">
                  <dt className="text-[11px] font-medium text-muted">Por hora</dt>
                  <dd className="m-0 font-mono text-[18px] leading-none font-semibold">{conMonto && reparto.horas > 0 ? fmtValorHora(reparto.valorHora) : '—'}</dd>
                </div>
              </dl>

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
                  <div className="h-2 overflow-hidden rounded-full bg-foot" role="progressbar" aria-valuemin={0} aria-valuemax={filas.length} aria-valuenow={filas.length - pendientes.length} aria-label="Personas pagadas">
                    <div className="h-full rounded-full bg-olive transition-[width] duration-300" style={{ width: `${((filas.length - pendientes.length) / filas.length) * 100}%` }} />
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
                  description="La propina se reparte entre quienes trabajaron, según sus horas reales."
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
                      return (
                        <li key={f.emp.id} className={`flex items-center gap-3 border-b border-divider px-4 py-3 last:border-b-0 lg:px-5 ${f.pago ? 'bg-[#FAFBF7]' : ''}`}>
                          <Avatar nombre={f.emp.nombre} size={36} />
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="truncate text-sm font-semibold">{f.emp.nombre}</span>
                            <span className="truncate font-mono text-[12px] text-muted">
                              {fmtHoras(f.horas)}
                              {diferencia && (
                                <span className="ml-1.5 inline-flex items-center gap-1 font-sans font-medium text-warn">
                                  <AlertTriangle size={11} aria-hidden="true" />
                                  se pagó {fmtPesos(f.pago!.monto)}
                                </span>
                              )}
                            </span>
                          </span>
                          <span className={`shrink-0 font-mono text-[15px] font-semibold ${conMonto ? 'text-money' : 'text-faint'}`}>{conMonto ? fmtPesos(f.parte) : '—'}</span>
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
