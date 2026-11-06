import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageBody, PageHeader } from '../../components/PageHeader'
import { Button, ConfirmDialog, Notice, Segmented, Sheet } from '../../components/ui'
import { TURNO_COLORS, turnoColor } from '../../lib/colors'
import {
  DIAS_LETRA,
  addDays,
  diasDeSemana,
  fechaCorta,
  fechaLarga,
  hoyISO,
  indiceDia,
  lunesDe,
  numeroDia,
  rangoSemana,
} from '../../lib/fechas'
import { useLocal, useLocalId } from '../../lib/local'
import { useSemana } from '../../lib/semana'
import { corta } from '../../lib/time'
import type { Area, Asignacion, Empleado, OpcionTurno, TipoTurno } from '../../lib/types'
import { useIsDesktop } from '../../lib/useMedia'
import { useTabla } from '../../lib/useTabla'
import { Compartir } from './Compartir'
import { Lista } from './Lista'
import { PorHoras } from './PorHoras'
import { SemanaCompleta } from './SemanaCompleta'
import { TurnoPicker } from './TurnoPicker'

type Vista = 'horas' | 'lista' | 'semana'
type Confirmar = 'semana' | 'dia' | 'reset' | null

export function SemanaPage() {
  const localId = useLocalId()
  const { local } = useLocal()
  const desktop = useIsDesktop()

  const areas = useTabla<Area>('areas', localId, [{ col: 'orden' }, { col: 'nombre' }])
  const emps = useTabla<Empleado>('empleados', localId, [{ col: 'orden' }, { col: 'nombre' }])
  const tiposT = useTabla<TipoTurno>('tipos_turno', localId, [{ col: 'orden' }, { col: 'inicio' }])
  const tipos = useMemo(() => tiposT.rows.filter((t) => !t.archivado), [tiposT.rows])

  const hoy = hoyISO()
  const [lunes, setLunes] = useState(() => lunesDe(hoy))
  const [dia, setDia] = useState(hoy)
  const [vistaElegida, setVista] = useState<Vista>('horas')
  const vista: Vista = vistaElegida === 'semana' && !desktop ? 'horas' : vistaElegida
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [confirmar, setConfirmar] = useState<Confirmar>(null)
  const [busy, setBusy] = useState(false)
  const [editor, setEditor] = useState<{ emp: Empleado; fecha: string } | null>(null)
  const [compartir, setCompartir] = useState(false)

  const activos = useMemo(() => new Set(emps.rows.filter((e) => e.activo).map((e) => e.id)), [emps.rows])
  const semana = useSemana(localId, lunes, activos)
  const dias = diasDeSemana(lunes)

  // Índice rápido de turnos por persona y día.
  const indice = useMemo(() => {
    const m = new Map<string, Asignacion[]>()
    for (const a of semana.asignaciones) {
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

  // Activos + los dados de baja que igual tienen turnos esta semana.
  const conTurnos = useMemo(() => new Set(semana.asignaciones.map((a) => a.empleado_id)), [semana.asignaciones])
  const visibles = emps.rows.filter((e) => e.activo || conTurnos.has(e.id))

  const turnosDelDia = semana.asignaciones.filter((a) => a.fecha_jornada === dia)
  const resumen = [
    ...tipos.map((t) => ({
      key: t.id,
      nombre: t.nombre,
      hora: `${corta(t.inicio)}–${corta(t.fin)}`,
      c: turnoColor(t.color),
      n: turnosDelDia.filter((a) => a.tipo_turno_id === t.id).length,
      fijo: true,
    })),
    {
      key: 'otro',
      nombre: 'Especial',
      hora: 'a mano',
      c: TURNO_COLORS.especial,
      n: turnosDelDia.filter((a) => a.tipo_turno_id === null || !tipos.some((t) => t.id === a.tipo_turno_id)).length,
      fijo: false,
    },
  ].filter((r) => r.fijo || r.n > 0)

  const irASemana = (nuevoLunes: string) => {
    setLunes(nuevoLunes)
    setDia(nuevoLunes === lunesDe(hoy) ? hoy : nuevoLunes)
    setMsg(null)
  }

  const elegirDia = (d: string) => {
    setDia(d)
    setMsg(null)
  }

  const asignar = async (emp: Empleado, fecha: string, op: OpcionTurno) => {
    setMsg(null)
    const r = await semana.asignar(emp.id, fecha, op)
    if (!r.ok) setMsg({ tone: 'error', text: r.mensaje })
  }

  const ejecutar = async (accion: Exclude<Confirmar, null>) => {
    setBusy(true)
    const r =
      accion === 'semana'
        ? await semana.copiarSemanaAnterior()
        : accion === 'dia'
          ? await semana.copiarDiaAnterior(dia)
          : await semana.restablecerDia(dia)
    setBusy(false)
    setConfirmar(null)
    setMsg({ tone: r.ok ? 'ok' : 'error', text: r.mensaje })
  }

  const pedir = (accion: Exclude<Confirmar, null>) => {
    const hayDatos = accion === 'semana' ? semana.asignaciones.length > 0 : turnosDelDia.length > 0
    if (accion === 'reset' && !hayDatos) return setMsg({ tone: 'ok', text: 'Este día ya está vacío.' })
    if (hayDatos) setConfirmar(accion)
    else ejecutar(accion)
  }

  const textosConfirmar = {
    semana: {
      title: '¿Reemplazar esta semana?',
      message: `La semana ${rangoSemana(lunes)} ya tiene turnos. Se van a reemplazar por los de la semana anterior.`,
      label: 'Copiar semana',
      danger: false,
    },
    dia: {
      title: `¿Reemplazar el ${fechaCorta(dia)}?`,
      message: `Este día ya tiene turnos. Se van a reemplazar por los del ${fechaCorta(addDays(dia, -1))}.`,
      label: 'Copiar día',
      danger: false,
    },
    reset: {
      title: `¿Vaciar el ${fechaCorta(dia)}?`,
      message: 'Se borran todos los turnos de ese día, con sus horas corregidas y ausencias.',
      label: 'Vaciar día',
      danger: true,
    },
  }

  const cargando = areas.loading || emps.loading || tiposT.loading || semana.loading
  const errorCarga = areas.error ?? emps.error ?? tiposT.error ?? semana.error

  const vistaProps = {
    areas: areas.rows,
    empleados: visibles,
    tipos,
    turnosDe,
    horasSemana,
    fecha: dia,
    onPick: asignar,
    onEditar: (emp: Empleado, fecha: string) => setEditor({ emp, fecha }),
  }

  return (
    <>
      <PageHeader
        title="Horarios"
        subtitle={vista === 'semana' ? 'Toda la semana · tocá un casillero para cambiarlo' : fechaLarga(dia)}
        action={
          <Button variant="primary" onClick={() => setCompartir(true)} disabled={cargando || visibles.length === 0}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
              <path d="M16 6l-4-4-4 4" />
              <path d="M12 2v13" />
            </svg>
            Compartir
          </Button>
        }
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => irASemana(addDays(lunes, -7))}
            aria-label="Semana anterior"
            className="flex size-11 items-center justify-center rounded-xl border border-line bg-card"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <span className="min-w-[150px] text-center text-[15px] font-medium">Semana {rangoSemana(lunes)}</span>
          <button
            type="button"
            onClick={() => irASemana(addDays(lunes, 7))}
            aria-label="Semana siguiente"
            className="flex size-11 items-center justify-center rounded-xl border border-line bg-card"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
          {lunes !== lunesDe(hoy) && (
            <button type="button" onClick={() => irASemana(lunesDe(hoy))} className="h-11 px-2 text-sm font-medium text-olive">
              Hoy
            </button>
          )}
        </div>

        {vista !== 'semana' && (
          <div className="grid grid-cols-7 gap-1.5 lg:max-w-2xl">
            {dias.map((d) => {
              const on = d === dia
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => elegirDia(d)}
                  aria-label={fechaLarga(d)}
                  aria-pressed={on}
                  className={`relative flex h-[54px] flex-col items-center justify-center gap-0.5 rounded-[14px] border ${
                    on ? 'border-olive bg-olive text-white' : 'border-line bg-card text-ink'
                  }`}
                >
                  <span className="text-xs font-medium">{DIAS_LETRA[indiceDia(d)]}</span>
                  <span className="font-mono text-[15px] font-semibold">{numeroDia(d)}</span>
                  {d === hoy && !on && <span aria-hidden="true" className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-khaki" />}
                </button>
              )
            })}
          </div>
        )}
      </PageHeader>

      <PageBody>
        {cargando ? (
          <p className="text-sm text-muted" role="status">
            Cargando…
          </p>
        ) : errorCarga ? (
          <Notice tone="error">{errorCarga}</Notice>
        ) : visibles.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-line bg-card p-5">
            <p className="m-0 text-sm text-muted">Todavía no hay empleados cargados.</p>
            <Link to="/configuracion" className="inline-flex h-11 items-center rounded-xl bg-olive px-4 text-sm font-semibold text-white">
              Cargar el equipo
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Segmented
                label="Vista"
                value={vista}
                onChange={setVista}
                options={[
                  { value: 'horas', label: 'Por horas' },
                  { value: 'lista', label: 'Lista' },
                  ...(desktop ? [{ value: 'semana' as Vista, label: 'Semana completa' }] : []),
                ]}
              />
              <div className="grid grid-cols-3 gap-1.5 lg:flex lg:gap-2">
                <AccionBtn onClick={() => pedir('semana')} label="Copiar semana" icon="semana" />
                <AccionBtn onClick={() => pedir('dia')} label="Copiar día anterior" icon="dia" />
                <AccionBtn onClick={() => pedir('reset')} label="Restablecer día" icon="reset" danger />
              </div>
            </div>

            {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

            {vista !== 'semana' && (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(78px,1fr))] gap-2 lg:grid-cols-[repeat(auto-fill,minmax(170px,190px))]">
                {resumen.map((r) => (
                  <div
                    key={r.key}
                    className="flex min-w-0 flex-col items-start gap-1.5 rounded-2xl border border-line bg-card p-2.5 lg:gap-2 lg:p-3"
                  >
                    <span
                      className="max-w-full truncate rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                      style={{ background: r.c.bg, color: r.c.fg, borderColor: r.c.bd }}
                    >
                      {r.nombre}
                    </span>
                    <span className="font-mono text-[22px] leading-none font-bold lg:text-[26px]">{r.n}</span>
                    <span className="font-mono text-[10px] whitespace-nowrap text-muted lg:text-[11px]">{r.hora}</span>
                  </div>
                ))}
              </div>
            )}

            {semana.asignaciones.length === 0 && (
              <p className="m-0 text-sm text-muted">
                Semana vacía. Asigná turnos tocando a cada persona, o usá <span className="font-semibold text-ink">Copiar semana</span>{' '}
                para partir de la anterior.
              </p>
            )}

            {vista === 'horas' && <PorHoras {...vistaProps} />}
            {vista === 'lista' && <Lista {...vistaProps} />}
            {vista === 'semana' && (
              <SemanaCompleta
                areas={areas.rows}
                empleados={visibles}
                dias={dias}
                diaSeleccionado={dia}
                turnosDe={turnosDe}
                horasSemana={horasSemana}
                onCelda={(emp, fecha) => {
                  setDia(fecha)
                  setEditor({ emp, fecha })
                }}
                onDia={elegirDia}
              />
            )}
          </>
        )}
      </PageBody>

      <Sheet
        open={!!editor}
        title={editor ? `${editor.emp.nombre} · ${fechaCorta(editor.fecha)}` : ''}
        onClose={() => setEditor(null)}
      >
        {editor && (
          <TurnoPicker
            key={`${editor.emp.id}-${editor.fecha}`}
            tipos={tipos}
            actual={turnosDe(editor.emp.id, editor.fecha)[0]}
            onPick={(op) => {
              asignar(editor.emp, editor.fecha, op)
              if (op === null || 'tipo' in op) setEditor(null)
            }}
            onDone={() => setEditor(null)}
          />
        )}
      </Sheet>

      {confirmar && (
        <ConfirmDialog
          open
          title={textosConfirmar[confirmar].title}
          message={textosConfirmar[confirmar].message}
          confirmLabel={textosConfirmar[confirmar].label}
          danger={textosConfirmar[confirmar].danger}
          busy={busy}
          onConfirm={() => ejecutar(confirmar)}
          onCancel={() => setConfirmar(null)}
        />
      )}

      <Compartir
        open={compartir}
        onClose={() => setCompartir(false)}
        localNombre={local?.nombre ?? ''}
        lunes={lunes}
        dias={dias}
        areas={areas.rows}
        empleados={visibles}
        tipos={tipos}
        asignaciones={semana.asignaciones}
        turnosDe={turnosDe}
      />
    </>
  )
}

function AccionBtn({ onClick, label, icon, danger = false }: { onClick: () => void; label: string; icon: 'semana' | 'dia' | 'reset'; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-[52px] flex-col items-center justify-center gap-1 rounded-xl border bg-card px-1 text-[11px] leading-tight font-semibold lg:h-11 lg:flex-row lg:gap-2 lg:px-4 lg:text-sm ${
        danger ? 'border-danger-line text-danger hover:bg-danger-soft' : 'border-line text-ink hover:bg-head'
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {icon === 'semana' && (
          <>
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </>
        )}
        {icon === 'dia' && (
          <>
            <rect x="9" y="9" width="12" height="12" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </>
        )}
        {icon === 'reset' && (
          <>
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v5h5" />
          </>
        )}
      </svg>
      <span className="text-center leading-tight">{label}</span>
    </button>
  )
}
