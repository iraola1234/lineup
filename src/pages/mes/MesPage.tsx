import { ArrowDown, ArrowUp, BarChart3, ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react'
import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageBody, PageHeader } from '../../components/PageHeader'
import { useToast } from '../../components/toast'
import { Avatar, Button, EmptyState, IconButton, Notice, Skeleton } from '../../components/ui'
import { useData } from '../../lib/data'
import { jornadaActual } from '../../lib/fechas'
import { useLocal, useLocalId } from '../../lib/local'
import { moverMes, nombreMes, useMes } from '../../lib/mes'
import { fmtPesos } from '../../lib/propinas'
import { fmtHoras } from '../../lib/time'
import { calcularMes, type FilaPersona } from './calculo'
import { DetallePersona } from './DetallePersona'

type Orden = 'area' | 'nombre' | 'dias' | 'reales' | 'propina'

const sinUnidad = (h: number) => fmtHoras(h).replace(' h', '')
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

export function MesPage() {
  const localId = useLocalId()
  const { local } = useLocal()
  const { areas, empleados, loading: cargandoDatos, error: errorDatos } = useData()
  const toast = useToast()

  const hoy = jornadaActual()
  const mesActual = hoy.slice(0, 7)
  const [mes, setMes] = useState(mesActual)
  const { datos, loading, error, reload } = useMes(localId, mes)
  const [orden, setOrden] = useState<Orden>('area')
  const [abierto, setAbierto] = useState<string | null>(null)
  const [exportando, setExportando] = useState(false)

  const resumen = useMemo(
    () => (datos && !cargandoDatos ? calcularMes(datos, empleados, areas, mes, hoy) : null),
    [datos, cargandoDatos, empleados, areas, mes, hoy],
  )

  const ordenadas = useMemo(() => {
    if (!resumen) return []
    const p = [...resumen.personas]
    if (orden === 'nombre') p.sort((a, b) => a.emp.nombre.localeCompare(b.emp.nombre))
    if (orden === 'dias') p.sort((a, b) => b.dias - a.dias)
    if (orden === 'reales') p.sort((a, b) => b.reales - a.reales)
    if (orden === 'propina') p.sort((a, b) => b.propina - a.propina)
    return p
  }, [resumen, orden])

  const grupos = useMemo(() => {
    if (orden !== 'area') return [{ id: 'todos', nombre: '', filas: ordenadas }]
    const out: { id: string; nombre: string; filas: FilaPersona[] }[] = []
    for (const f of ordenadas) {
      const id = f.area?.id ?? 'sin'
      let g = out.find((x) => x.id === id)
      if (!g) out.push((g = { id, nombre: f.area?.nombre ?? 'Sin área', filas: [] }))
      g.filas.push(f)
    }
    return out
  }, [ordenadas, orden])

  const exportar = async () => {
    if (!resumen) return
    setExportando(true)
    try {
      const { exportarExcel } = await import('./excel')
      await exportarExcel(resumen, mes, local?.nombre ?? 'Lineup')
      toast.show(`Excel de ${nombreMes(mes)} descargado`)
    } catch {
      toast.show('No se pudo generar el Excel. Probá de nuevo.', { tone: 'error' })
    } finally {
      setExportando(false)
    }
  }

  const persona = resumen?.personas.find((p) => p.emp.id === abierto) ?? null
  const t = resumen?.totales
  const vacio = !!resumen && resumen.personas.length === 0
  const errorCarga = errorDatos ?? error

  return (
    <>
      <PageHeader
        title="Resumen del mes"
        subtitle="Horas y propinas por persona"
        actions={
          <>
            <Button onClick={exportar} loading={exportando} disabled={!resumen || vacio} icon={<FileSpreadsheet size={16} />} className="max-lg:hidden">
              Exportar a Excel
            </Button>
            <IconButton label="Exportar a Excel" onClick={exportar} disabled={!resumen || vacio || exportando} className="lg:hidden">
              <FileSpreadsheet size={20} />
            </IconButton>
          </>
        }
      >
        <div className="flex items-center gap-1">
          <div className="flex items-center rounded-xl border border-line bg-card shadow-xs">
            <IconButton label="Mes anterior" onClick={() => setMes(moverMes(mes, -1))} className="rounded-r-none">
              <ChevronLeft size={18} />
            </IconButton>
            <span className="min-w-[150px] border-x border-line px-3 text-center text-sm leading-[44px] font-semibold capitalize">{nombreMes(mes)}</span>
            <IconButton label="Mes siguiente" onClick={() => setMes(moverMes(mes, 1))} className="rounded-l-none">
              <ChevronRight size={18} />
            </IconButton>
          </div>
          {mes !== mesActual && (
            <Button variant="ghost" onClick={() => setMes(mesActual)} className="text-olive">
              Este mes
            </Button>
          )}
        </div>
      </PageHeader>

      <PageBody>
        {errorCarga ? (
          <EmptyState
            icon={<BarChart3 size={22} />}
            title="No pudimos cargar el mes"
            description={`${errorCarga} Revisá la conexión.`}
            action={<Button onClick={() => reload()}>Reintentar</Button>}
          />
        ) : loading || !resumen || !t ? (
          <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-[92px] rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        ) : vacio ? (
          <EmptyState
            icon={<BarChart3 size={22} />}
            title={`No hay turnos en ${nombreMes(mes)}`}
            description="Cuando armes horarios para este mes, acá vas a ver las horas y propinas de cada persona."
            action={
              <Link to="/" className="inline-flex h-11 items-center rounded-xl border border-line bg-card px-4 text-sm font-semibold shadow-xs transition-colors hover:border-line-strong hover:bg-hover active:bg-press">
                Ir a Horarios
              </Link>
            }
          />
        ) : (
          <>
            <dl className="m-0 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              <Kpi titulo="Horas reales" valor={sinUnidad(t.reales)} unidad="h" detalle={`de ${sinUnidad(t.plan)} h planificadas`} />
              <Kpi
                titulo="Propinas"
                valor={fmtPesos(t.propinaRepartida)}
                detalle={t.propinaCargada > 0 ? plural(resumen.dias.filter((d) => d.reparto).length, 'día cargado', 'días cargados') : 'Todavía sin cargar'}
              />
              <Kpi titulo="Personas" valor={String(resumen.personas.length)} detalle="con turnos en el mes" />
              <Kpi
                titulo="Días cerrados"
                valor={`${t.diasCerrados}/${t.diasConTurnos}`}
                detalle={t.diasPendientes > 0 ? plural(t.diasPendientes, 'pendiente', 'pendientes') : 'Todo al día'}
                aviso={t.diasPendientes > 0}
              />
            </dl>

            {t.diasPendientes > 0 && (
              <Notice tone="info">
                <span>
                {t.diasPendientes === 1 ? 'Hay 1 día sin cerrar' : `Hay ${t.diasPendientes} días sin cerrar`}: ahí se cuentan las horas planificadas hasta que lo confirmes en{' '}
                <Link to="/cierre" className="font-semibold underline decoration-1 underline-offset-2 hover:no-underline">
                  Cierre
                </Link>.
                </span>
              </Notice>
            )}

            {/* Celular: lista */}
            <div className="flex flex-col gap-3 lg:hidden">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium text-muted">Ordenar por</span>
                <select
                  value={orden}
                  onChange={(e) => setOrden(e.target.value as Orden)}
                  aria-label="Ordenar por"
                  className="h-9 rounded-xl border border-line bg-card px-3 text-[13px] font-semibold shadow-xs transition-colors hover:border-line-strong"
                >
                  <option value="area">Área</option>
                  <option value="nombre">Nombre</option>
                  <option value="reales">Más horas</option>
                  <option value="propina">Más propina</option>
                </select>
              </div>
              {grupos.map((g) => (
                <section key={g.id} className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
                  {g.nombre && (
                    <div className="flex items-center justify-between border-b border-line bg-head px-4 py-2.5">
                      <h2 className="m-0 text-[12px] font-semibold tracking-wide text-ink-2 uppercase">{g.nombre}</h2>
                      <span className="font-mono text-[11px] text-muted">{sinUnidad(g.filas.reduce((s, f) => s + f.reales, 0))}{'\u202F'}h</span>
                    </div>
                  )}
                  <ul className="m-0 list-none p-0">
                    {g.filas.map((f) => (
                      <li key={f.emp.id} className="border-b border-divider last:border-b-0">
                        <button
                          type="button"
                          onClick={() => setAbierto(f.emp.id)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-hover active:bg-press"
                        >
                          <Avatar nombre={f.emp.nombre} size={36} muted={!f.emp.activo} />
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="truncate text-sm font-semibold">{f.emp.nombre}</span>
                            <span className="truncate text-[12px] text-muted">
                              {plural(f.dias, 'día', 'días')}
                              {f.ausencias > 0 && <span className="text-danger"> · {plural(f.ausencias, 'ausencia', 'ausencias')}</span>}
                            </span>
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-0.5">
                            <span className="font-mono text-[15px] font-semibold">
                              {sinUnidad(f.reales)}
                              <span className="ml-0.5 text-[11px] font-medium text-muted">h</span>
                            </span>
                            <span className="font-mono text-[12px] text-money">{f.propina > 0 ? fmtPesos(f.propina) : '—'}</span>
                          </span>
                          <ChevronRight size={16} className="text-faint" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            {/* Computadora: tabla */}
            <div className="hidden overflow-hidden rounded-2xl border border-line bg-card shadow-card lg:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line bg-head text-left text-[12px] text-muted">
                    <Th orden={orden} campo="nombre" onOrden={setOrden} className="pl-5">
                      Persona
                    </Th>
                    <Th orden={orden} campo="dias" onOrden={setOrden} num>
                      Días
                    </Th>
                    <th className="px-3 py-2.5 text-right font-medium">Ausencias</th>
                    <th className="px-3 py-2.5 text-right font-medium">Planificadas</th>
                    <Th orden={orden} campo="reales" onOrden={setOrden} num>
                      Reales
                    </Th>
                    <th className="px-3 py-2.5 text-right font-medium">Diferencia</th>
                    <Th orden={orden} campo="propina" onOrden={setOrden} num className="pr-5">
                      Propina
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((g) => (
                    <Fragment key={g.id}>
                      {g.nombre && (
                        <tr className="border-b border-line bg-foot">
                          <th colSpan={4} scope="colgroup" className="px-5 py-2 text-left text-[11px] font-semibold tracking-wide text-ink-2 uppercase">
                            {g.nombre} <span className="ml-1 font-mono font-normal text-muted">{g.filas.length}</span>
                          </th>
                          <td className="px-3 py-2 text-right font-mono text-[12px] font-semibold text-ink-2">{sinUnidad(g.filas.reduce((s, f) => s + f.reales, 0))}</td>
                          <td />
                          <td className="py-2 pr-5 pl-3 text-right font-mono text-[12px] font-semibold text-ink-2">
                            {fmtPesos(g.filas.reduce((s, f) => s + f.propina, 0))}
                          </td>
                        </tr>
                      )}
                      {g.filas.map((f) => {
                        const dif = f.reales - f.plan
                        return (
                          <tr
                            key={f.emp.id}
                            onClick={() => setAbierto(f.emp.id)}
                            className="group cursor-pointer border-b border-divider transition-colors last:border-b-0 hover:bg-hover active:bg-press"
                          >
                            <td className="py-2.5 pr-3 pl-5">
                              <button type="button" onClick={() => setAbierto(f.emp.id)} className="flex items-center gap-3 text-left outline-offset-4">
                                <Avatar nombre={f.emp.nombre} size={32} muted={!f.emp.activo} />
                                <span className="flex flex-col">
                                  <span className="font-semibold group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-2">{f.emp.nombre}</span>
                                  <span className="text-[12px] text-muted">
                                    {f.emp.puesto || f.area?.nombre}
                                    {!f.emp.activo && ' · de baja'}
                                  </span>
                                </span>
                              </button>
                            </td>
                            <td className="px-3 text-right font-mono tabular-nums">{f.dias}</td>
                            <td className={`px-3 text-right font-mono tabular-nums ${f.ausencias ? 'font-semibold text-danger' : 'text-faint'}`}>{f.ausencias || '—'}</td>
                            <td className="px-3 text-right font-mono text-muted tabular-nums">{sinUnidad(f.plan)}</td>
                            <td className="px-3 text-right font-mono font-semibold tabular-nums">{sinUnidad(f.reales)}</td>
                            <td className={`px-3 text-right font-mono tabular-nums ${dif > 0 ? 'text-olive' : dif < 0 ? 'text-danger' : 'text-faint'}`}>
                              {dif === 0 ? '—' : `${dif > 0 ? '+' : '−'}${sinUnidad(Math.abs(dif))}`}
                            </td>
                            <td className="pr-5 pl-3 text-right font-mono font-semibold text-money tabular-nums">{f.propina > 0 ? fmtPesos(f.propina) : <span className="font-normal text-faint">—</span>}</td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line bg-foot font-semibold">
                    <td className="py-3 pr-3 pl-5">Total</td>
                    <td />
                    <td className="px-3 text-right font-mono tabular-nums">{resumen.personas.reduce((s, f) => s + f.ausencias, 0) || '—'}</td>
                    <td className="px-3 text-right font-mono tabular-nums">{sinUnidad(t.plan)}</td>
                    <td className="px-3 text-right font-mono tabular-nums">{sinUnidad(t.reales)}</td>
                    <td />
                    <td className="pr-5 pl-3 text-right font-mono text-money tabular-nums">{fmtPesos(t.propinaRepartida)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </PageBody>

      <DetallePersona persona={persona} resumen={resumen} onClose={() => setAbierto(null)} />
    </>
  )
}

function Kpi({ titulo, valor, unidad, detalle, aviso = false }: { titulo: string; valor: string; unidad?: string; detalle: string; aviso?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-line bg-card p-4 shadow-card lg:p-5">
      <dt className="text-[12px] font-medium text-muted">{titulo}</dt>
      <dd className="m-0 flex flex-col gap-1">
        <span className="font-mono text-[24px] leading-none font-semibold tracking-tight lg:text-[28px]">
          {valor}
          {unidad && <span className="ml-1 text-[13px] font-medium text-muted">{unidad}</span>}
        </span>
        <span className={`text-[12px] ${aviso ? 'font-medium text-warn' : 'text-muted'}`}>{detalle}</span>
      </dd>
    </div>
  )
}

function Th({
  orden,
  campo,
  onOrden,
  num = false,
  className = '',
  children,
}: {
  orden: Orden
  campo: Orden
  onOrden: (o: Orden) => void
  num?: boolean
  className?: string
  children: ReactNode
}) {
  const activo = orden === campo
  const Flecha = campo === 'nombre' ? ArrowUp : ArrowDown
  return (
    <th scope="col" aria-sort={activo ? (campo === 'nombre' ? 'ascending' : 'descending') : 'none'} className={`px-3 py-1.5 font-medium ${num ? 'text-right' : ''} ${className}`}>
      <button
        type="button"
        onClick={() => onOrden(activo ? 'area' : campo)}
        title={activo ? 'Volver a ordenar por área' : `Ordenar por ${String(children).toLowerCase()}`}
        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 ${num ? '-mr-2 flex-row-reverse' : '-ml-2'} transition-colors hover:bg-hover hover:text-ink active:bg-press ${activo ? 'text-ink' : ''}`}
      >
        {children}
        <Flecha size={12} aria-hidden="true" className={activo ? 'opacity-100' : 'opacity-0'} />
      </button>
    </th>
  )
}
