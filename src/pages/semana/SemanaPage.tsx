import {
  CalendarSync,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eraser,
  Loader2,
  MoreHorizontal,
  Rows3,
  Share,
  Clock3,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageBody, PageHeader } from '../../components/PageHeader'
import { useToast } from '../../components/toast'
import { Button, ConfirmDialog, EmptyState, IconButton, Menu, Segmented, Skeleton, type MenuItem } from '../../components/ui'
import { TURNO_COLORS, turnoColor } from '../../lib/colors'
import { useData } from '../../lib/data'
import { DIAS_LETRA, addDays, diasDeSemana, fechaCorta, fechaLarga, hoyISO, indiceDia, lunesDe, numeroDia, rangoSemana } from '../../lib/fechas'
import { useLocal, useLocalId } from '../../lib/local'
import { aFila, copiarFila, filaDesdeOpcion, useSemana, type Cambio } from '../../lib/semana'
import { corta, fmtHoras } from '../../lib/time'
import type { Asignacion, Empleado, OpcionTurno } from '../../lib/types'
import { useIsDesktop } from '../../lib/useMedia'
import { Compartir } from './Compartir'
import { DiaPorHoras } from './DiaPorHoras'
import { EditorTurno } from './EditorTurno'
import { GrillaSemana } from './GrillaSemana'
import { horasTotales, porArea } from './helpers'
import { Lista } from './Lista'

type Vista = 'semana' | 'dia' | 'lista'
type Pendiente = { titulo: string; mensaje: string; label: string; danger?: boolean; run: () => Promise<void> }

export function SemanaPage() {
  const localId = useLocalId()
  const { local } = useLocal()
  const { areas, empleados, tiposActivos: tipos, loading: cargandoDatos, error: errorDatos } = useData()
  const desktop = useIsDesktop()
  const toast = useToast()

  const hoy = hoyISO()
  const [lunes, setLunes] = useState(() => lunesDe(hoy))
  const [dia, setDia] = useState(hoy)
  const [vistaElegida, setVista] = useState<Vista | null>(null)
  const vista: Vista = (() => {
    const v = vistaElegida ?? (desktop ? 'semana' : 'dia')
    if (desktop && v === 'lista') return 'dia'
    if (!desktop && v === 'semana') return 'dia'
    return v
  })()
  const [editor, setEditor] = useState<{ emp: Empleado; fecha: string } | null>(null)
  const [pendiente, setPendiente] = useState<Pendiente | null>(null)
  const [busy, setBusy] = useState(false)
  const [compartir, setCompartir] = useState(false)

  const semana = useSemana(localId, lunes)
  const dias = diasDeSemana(lunes)

  const indice = useMemo(() => {
    const m = new Map<string, Asignacion[]>()
    for (const a of [...semana.asignaciones].sort((x, y) => x.inicio_plan.localeCompare(y.inicio_plan))) {
      const k = `${a.empleado_id}|${a.fecha_jornada}`
      m.set(k, [...(m.get(k) ?? []), a])
    }
    return m
  }, [semana.asignaciones])
  const turnosDe = (empId: string, fecha: string) => indice.get(`${empId}|${fecha}`) ?? []

  const horasSemana = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of semana.asignaciones) m.set(a.empleado_id, (m.get(a.empleado_id) ?? 0) + Number(a.horas_plan))
    return m
  }, [semana.asignaciones])

  // Activos + dados de baja que igual tienen turnos esta semana.
  const conTurnos = useMemo(() => new Set(semana.asignaciones.map((a) => a.empleado_id)), [semana.asignaciones])
  const visibles = useMemo(() => empleados.filter((e) => e.activo || conTurnos.has(e.id)), [empleados, conTurnos])
  const grupos = useMemo(() => porArea(areas, visibles), [areas, visibles])
  const activos = useMemo(() => new Set(empleados.filter((e) => e.activo).map((e) => e.id)), [empleados])

  /* ---------- Cambios (con deshacer) ---------- */

  const aplicar = (cambios: Cambio[], mensaje: string) => {
    const { deshacer, guardado } = semana.aplicar(cambios)
    toast.show(mensaje, {
      action: {
        label: 'Deshacer',
        onClick: () => {
          semana.aplicar(deshacer).guardado.then((ok) => ok && toast.show('Cambio deshecho'))
        },
      },
    })
    guardado.then((ok) => {
      if (!ok) toast.show('No se pudo guardar el cambio. Revisá la conexión y probá de nuevo.', { tone: 'error' })
    })
  }

  const describir = (op: OpcionTurno) =>
    op === null ? 'libre' : 'tipo' in op ? `${op.tipo.nombre} ${corta(op.tipo.inicio)}–${corta(op.tipo.fin)}` : `${op.otro.inicio}–${op.otro.fin}`

  const setTurno = (emp: Empleado, fecha: string, op: OpcionTurno, cerrar = true) => {
    aplicar(
      [{ desde: fecha, hasta: fecha, empleado: emp.id, filas: op ? [filaDesdeOpcion(emp.id, fecha, op)] : [] }],
      `${emp.nombre.split(' ')[0]} · ${fechaCorta(fecha)}: ${describir(op)}`,
    )
    if (cerrar) setEditor(null)
  }

  const addTurno = (emp: Empleado, fecha: string, op: Exclude<OpcionTurno, null>) => {
    const actuales = turnosDe(emp.id, fecha).map(aFila)
    aplicar(
      [{ desde: fecha, hasta: fecha, empleado: emp.id, filas: [...actuales, filaDesdeOpcion(emp.id, fecha, op)] }],
      `${emp.nombre.split(' ')[0]} · ${fechaCorta(fecha)}: se agregó ${describir(op)}`,
    )
    setEditor(null)
  }

  const removeTurno = (emp: Empleado, fecha: string, id: string) => {
    const resto = turnosDe(emp.id, fecha).filter((a) => a.id !== id).map(aFila)
    aplicar([{ desde: fecha, hasta: fecha, empleado: emp.id, filas: resto }], `${emp.nombre.split(' ')[0]} · ${fechaCorta(fecha)}: turno quitado`)
  }

  const mover = (id: string, destino: Empleado, fecha: string, copiar: boolean) => {
    const a = semana.asignaciones.find((x) => x.id === id)
    if (!a || (a.empleado_id === destino.id && a.fecha_jornada === fecha)) return
    const cambios: Cambio[] = []
    if (!copiar) {
      const restoOrigen = turnosDe(a.empleado_id, a.fecha_jornada).filter((x) => x.id !== id).map(aFila)
      cambios.push({ desde: a.fecha_jornada, hasta: a.fecha_jornada, empleado: a.empleado_id, filas: restoOrigen })
    }
    cambios.push({ desde: fecha, hasta: fecha, empleado: destino.id, filas: [copiarFila(a, { empleado_id: destino.id, fecha_jornada: fecha })] })
    aplicar(cambios, `${copiar ? 'Copiado' : 'Movido'} a ${destino.nombre.split(' ')[0]} · ${fechaCorta(fecha)}`)
  }

  const confirmarSi = (hayDatos: boolean, p: Pendiente) => (hayDatos ? setPendiente(p) : p.run())

  const copiarSemana = () =>
    confirmarSi(semana.asignaciones.length > 0, {
      titulo: '¿Reemplazar esta semana?',
      mensaje: `La semana del ${rangoSemana(lunes)} ya tiene turnos. Se reemplazan por los de la semana anterior. Vas a poder deshacerlo.`,
      label: 'Copiar semana',
      run: async () => {
        const src = await semana.leerRango(addDays(lunes, -7), addDays(lunes, -1))
        if (!src) return toast.show('No se pudo leer la semana anterior. Probá de nuevo.', { tone: 'error' })
        if (src.length === 0) return toast.show('La semana anterior no tiene turnos para copiar.', { tone: 'error' })
        const filas = src.filter((a) => activos.has(a.empleado_id)).map((a) => copiarFila(a, { fecha_jornada: addDays(a.fecha_jornada, 7) }))
        aplicar([{ desde: lunes, hasta: semana.domingo, empleado: null, filas }], `Se copiaron ${filas.length} turnos de la semana anterior`)
      },
    })

  const copiarDia = (fecha: string) => {
    const ayer = addDays(fecha, -1)
    confirmarSi(semana.asignaciones.some((a) => a.fecha_jornada === fecha), {
      titulo: `¿Reemplazar el ${fechaCorta(fecha)}?`,
      mensaje: `Este día ya tiene turnos. Se reemplazan por los del ${fechaCorta(ayer)}. Vas a poder deshacerlo.`,
      label: 'Copiar día',
      run: async () => {
        const src = ayer >= lunes ? semana.asignaciones.filter((a) => a.fecha_jornada === ayer) : await semana.leerRango(ayer, ayer)
        if (!src) return toast.show('No se pudo leer el día anterior.', { tone: 'error' })
        if (src.length === 0) return toast.show(`El ${fechaCorta(ayer)} no tiene turnos para copiar.`, { tone: 'error' })
        const filas = src.filter((a) => activos.has(a.empleado_id)).map((a) => copiarFila(a, { fecha_jornada: fecha }))
        aplicar([{ desde: fecha, hasta: fecha, empleado: null, filas }], `Se copiaron ${filas.length} turnos del ${fechaCorta(ayer)}`)
      },
    })
  }

  const vaciarDia = (fecha: string) => {
    const n = semana.asignaciones.filter((a) => a.fecha_jornada === fecha).length
    if (n === 0) return toast.show(`El ${fechaCorta(fecha)} ya está vacío.`)
    setPendiente({
      titulo: `¿Vaciar el ${fechaCorta(fecha)}?`,
      mensaje: `Se quitan los ${n} turnos de ese día, con sus horas corregidas y ausencias. Vas a poder deshacerlo.`,
      label: 'Vaciar día',
      danger: true,
      run: async () => aplicar([{ desde: fecha, hasta: fecha, empleado: null, filas: [] }], `Se vació el ${fechaCorta(fecha)}`),
    })
  }

  const accionesDia = (fecha: string): MenuItem[] => [
    { label: 'Copiar día anterior', description: `Trae los turnos del ${fechaCorta(addDays(fecha, -1))}`, icon: <Copy size={16} />, onSelect: () => copiarDia(fecha) },
    { label: 'Vaciar día', description: 'Quita todos los turnos de ese día', icon: <Eraser size={16} />, danger: true, onSelect: () => vaciarDia(fecha) },
  ]

  /* ---------- Navegación ---------- */

  const irASemana = (nuevoLunes: string) => {
    setLunes(nuevoLunes)
    setDia(nuevoLunes === lunesDe(hoy) ? hoy : nuevoLunes)
  }

  const turnosDelDia = semana.asignaciones.filter((a) => a.fecha_jornada === dia)
  const resumen = [
    ...tipos.map((t) => ({ key: t.id, nombre: t.nombre, c: turnoColor(t.color), n: turnosDelDia.filter((a) => a.tipo_turno_id === t.id).length })),
    {
      key: 'otro',
      nombre: 'Especial',
      c: TURNO_COLORS.especial,
      n: turnosDelDia.filter((a) => !tipos.some((t) => t.id === a.tipo_turno_id)).length,
    },
  ].filter((r) => r.n > 0)
  const personasDia = new Set(turnosDelDia.filter((a) => !a.ausente).map((a) => a.empleado_id)).size

  const cargando = cargandoDatos || semana.loading
  const errorCarga = errorDatos ?? semana.error
  const editorTurnos = editor ? turnosDe(editor.emp.id, editor.fecha) : []

  const menuMovil: MenuItem[] = [
    { label: 'Copiar semana anterior', description: `Reemplaza la semana del ${rangoSemana(lunes)}`, icon: <CalendarSync size={16} />, onSelect: copiarSemana },
    ...accionesDia(dia).map((it) => ({ ...it, label: it.label === 'Vaciar día' ? `Vaciar ${fechaCorta(dia)}` : `${it.label} (${fechaCorta(dia)})` })),
  ]

  return (
    <>
      <PageHeader
        title="Horarios"
        subtitle={vista === 'semana' ? `${local?.nombre ?? ''} · semana del ${rangoSemana(lunes)}` : fechaLarga(dia)}
        actions={
          <>
            {semana.guardando && (
              <span role="status" className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                Guardando…
              </span>
            )}
            {desktop ? (
              <>
                <Button onClick={copiarSemana} icon={<CalendarSync size={16} />} disabled={cargando}>
                  Copiar semana anterior
                </Button>
                <Button variant="primary" onClick={() => setCompartir(true)} icon={<Share size={16} />} disabled={cargando || visibles.length === 0}>
                  Compartir
                </Button>
              </>
            ) : (
              <>
                <IconButton label="Compartir la semana" onClick={() => setCompartir(true)} disabled={cargando || visibles.length === 0}>
                  <Share size={20} />
                </IconButton>
                <Menu
                  items={menuMovil}
                  trigger={({ toggle, ref, open }) => (
                    <IconButton ref={ref} label="Más acciones" onClick={toggle} aria-expanded={open} className={open ? 'bg-press text-ink' : ''}>
                      <MoreHorizontal size={20} />
                    </IconButton>
                  )}
                />
              </>
            )}
          </>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <div className="flex items-center rounded-xl border border-line bg-card shadow-xs">
              <IconButton label="Semana anterior" onClick={() => irASemana(addDays(lunes, -7))} className="rounded-r-none">
                <ChevronLeft size={18} />
              </IconButton>
              <span className="min-w-[120px] border-x border-line px-2 text-center text-sm leading-[44px] font-semibold tabular-nums">
                {rangoSemana(lunes)}
              </span>
              <IconButton label="Semana siguiente" onClick={() => irASemana(addDays(lunes, 7))} className="rounded-l-none">
                <ChevronRight size={18} />
              </IconButton>
            </div>
            {lunes !== lunesDe(hoy) && (
              <Button variant="ghost" size="md" onClick={() => irASemana(lunesDe(hoy))} className="text-olive">
                Hoy
              </Button>
            )}
          </div>
          <Segmented
            label="Vista"
            value={vista}
            onChange={setVista}
            className="max-lg:hidden"
            options={[
              { value: 'semana', label: 'Semana', icon: <CalendarDays size={15} /> },
              { value: 'dia', label: 'Día por horas', icon: <Clock3 size={15} /> },
            ]}
          />
        </div>

        {vista !== 'semana' && (
          <div className="grid grid-cols-7 gap-1.5 lg:max-w-[640px]">
            {dias.map((d) => {
              const on = d === dia
              const n = new Set(semana.asignaciones.filter((a) => a.fecha_jornada === d && !a.ausente).map((a) => a.empleado_id)).size
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDia(d)}
                  aria-label={`${fechaLarga(d)}, ${n} personas`}
                  aria-pressed={on}
                  className={`relative flex h-[62px] flex-col items-center justify-center gap-0.5 rounded-2xl border transition-[background-color,border-color,transform] duration-150 active:scale-[0.95] ${
                    on ? 'border-olive bg-olive text-white shadow-xs' : 'border-line bg-card text-ink hover:border-line-strong hover:bg-hover'
                  }`}
                >
                  <span className={`text-[11px] font-medium ${on ? 'text-white/80' : d === hoy ? 'text-olive' : 'text-muted'}`}>
                    {DIAS_LETRA[indiceDia(d)]}
                  </span>
                  <span className="font-mono text-base leading-none font-semibold">{numeroDia(d)}</span>
                  <span className={`flex items-center gap-0.5 font-mono text-[10px] ${on ? 'text-white/75' : 'text-faint'}`}>
                    <Users size={9} aria-hidden="true" />
                    {n}
                  </span>
                  {d === hoy && !on && <span aria-hidden="true" className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-khaki" />}
                </button>
              )
            })}
          </div>
        )}
      </PageHeader>

      <PageBody>
        {errorCarga ? (
          <EmptyState icon={<CalendarDays size={22} />} title="No pudimos cargar los horarios" description={`${errorCarga} Revisá la conexión.`} action={<Button onClick={() => semana.reload()}>Reintentar</Button>} />
        ) : cargando ? (
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando">
            <Skeleton className="h-10 w-full max-w-sm" />
            <div className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-8 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-8 flex-1" />
                </div>
              ))}
            </div>
          </div>
        ) : visibles.length === 0 ? (
          <EmptyState
            icon={<Users size={22} />}
            title="Todavía no cargaste a tu equipo"
            description="Sumá a las personas en Configuración y después armás la semana desde acá."
            action={
              <Link to="/configuracion" className="inline-flex h-11 items-center rounded-xl bg-olive px-4 text-sm font-semibold text-white transition-colors hover:bg-olive-dark">
                Cargar el equipo
              </Link>
            }
          />
        ) : (
          <>
            {!desktop && (
              <Segmented
                label="Vista"
                value={vista}
                onChange={setVista}
                options={[
                  { value: 'dia', label: 'Por horas', icon: <Clock3 size={15} /> },
                  { value: 'lista', label: 'Asignación rápida', icon: <Rows3 size={15} /> },
                ]}
              />
            )}

            {semana.asignaciones.length === 0 && (
              <div className="flex flex-col gap-3 rounded-2xl border border-olive-line bg-olive-soft/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-olive-darker">La semana del {rangoSemana(lunes)} está vacía</span>
                  <span className="text-[13px] text-ink-2">
                    {vista === 'semana' ? 'Hacé clic en un casillero para asignar' : 'Tocá a una persona para asignarle un turno'}, o partí de la semana anterior.
                  </span>
                </div>
                <Button variant="primary" onClick={copiarSemana} icon={<CalendarSync size={16} />}>
                  Copiar semana anterior
                </Button>
              </div>
            )}

            {vista !== 'semana' && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
                  <span className="flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-[13px] whitespace-nowrap shadow-xs">
                    <Users size={14} className="text-muted" aria-hidden="true" />
                    <span className="font-mono font-semibold">{personasDia}</span> personas
                    <span className="text-faint">·</span>
                    <span className="font-mono">{fmtHoras(horasTotales(turnosDelDia))}</span>
                  </span>
                  {resumen.map((r) => (
                    <span
                      key={r.key}
                      className="flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12px] font-medium whitespace-nowrap"
                      style={{ background: r.c.bg, color: r.c.fg, borderColor: r.c.bd }}
                    >
                      {r.nombre}
                      <span className="font-mono font-semibold">{r.n}</span>
                    </span>
                  ))}
                </div>
                {desktop && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => copiarDia(dia)} icon={<Copy size={15} />}>
                      Copiar día anterior
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => vaciarDia(dia)} icon={<Eraser size={15} />}>
                      Vaciar día
                    </Button>
                  </div>
                )}
              </div>
            )}

            {vista === 'semana' && (
              <GrillaSemana
                grupos={grupos}
                dias={dias}
                hoy={hoy}
                turnosDe={turnosDe}
                horasSemana={horasSemana}
                onAbrir={(emp, fecha) => {
                  setDia(fecha)
                  setEditor({ emp, fecha })
                }}
                onMover={mover}
                accionesDia={accionesDia}
              />
            )}
            {vista === 'dia' && (
              <DiaPorHoras grupos={grupos} tipos={tipos} turnosDe={turnosDe} horasSemana={horasSemana} fecha={dia} onAbrir={(emp, fecha) => setEditor({ emp, fecha })} />
            )}
            {vista === 'lista' && (
              <Lista
                grupos={grupos}
                tipos={tipos}
                turnosDe={turnosDe}
                horasSemana={horasSemana}
                fecha={dia}
                onAbrir={(emp, fecha) => setEditor({ emp, fecha })}
                onPick={(emp, fecha, op) => setTurno(emp, fecha, op, false)}
              />
            )}

            {vista === 'semana' && (
              <p className="m-0 text-xs text-faint">
                Consejo: arrastrá un turno para moverlo a otra persona o día. Con Alt (Option en Mac) lo copiás. Desde el menú ··· de cada día podés copiar el día anterior o vaciarlo.
              </p>
            )}
          </>
        )}
      </PageBody>

      <EditorTurno
        open={!!editor}
        emp={editor?.emp ?? null}
        fecha={editor?.fecha ?? dia}
        turnos={editorTurnos}
        tipos={tipos}
        horasSemana={editor ? (horasSemana.get(editor.emp.id) ?? 0) : 0}
        onClose={() => setEditor(null)}
        onSet={(op) => editor && setTurno(editor.emp, editor.fecha, op)}
        onAdd={(op) => editor && addTurno(editor.emp, editor.fecha, op)}
        onRemove={(id) => editor && removeTurno(editor.emp, editor.fecha, id)}
      />

      <ConfirmDialog
        open={!!pendiente}
        title={pendiente?.titulo ?? ''}
        message={pendiente?.mensaje ?? ''}
        confirmLabel={pendiente?.label ?? ''}
        danger={pendiente?.danger}
        busy={busy}
        onConfirm={async () => {
          if (!pendiente) return
          setBusy(true)
          await pendiente.run()
          setBusy(false)
          setPendiente(null)
        }}
        onCancel={() => setPendiente(null)}
      />

      <Compartir
        open={compartir}
        onClose={() => setCompartir(false)}
        localNombre={local?.nombre ?? ''}
        lunes={lunes}
        dias={dias}
        areas={areas}
        empleados={visibles}
        tipos={tipos}
        asignaciones={semana.asignaciones}
        turnosDe={turnosDe}
      />
    </>
  )
}
