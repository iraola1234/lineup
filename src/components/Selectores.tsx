import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DIAS_LETRA, addDays, lunesDe, rangoSemana, toISO } from '../lib/fechas'
import { moverMes, nombreMes } from '../lib/mes'
import { IconButton } from './ui'

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const NOMBRE_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

/** Popover simple: se cierra con Esc o tocando afuera. */
function usePopover() {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('pointerdown', fuera)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', fuera)
      document.removeEventListener('keydown', esc)
    }
  }, [abierto])
  return { abierto, setAbierto, ref }
}

/** Botonera ‹ [etiqueta] › con el panel debajo. */
function Marco({
  etiquetaAnterior,
  etiquetaSiguiente,
  onAnterior,
  onSiguiente,
  texto,
  ancho,
  panel,
  pop,
  descripcion,
}: {
  etiquetaAnterior: string
  etiquetaSiguiente: string
  onAnterior: () => void
  onSiguiente: () => void
  texto: string
  ancho: string
  panel: ReactNode
  pop: ReturnType<typeof usePopover>
  descripcion: string
}) {
  return (
    <div ref={pop.ref} className="relative">
      <div className="flex items-center rounded-xl border border-line bg-card shadow-xs">
        <IconButton label={etiquetaAnterior} onClick={onAnterior} className="rounded-r-none">
          <ChevronLeft size={18} />
        </IconButton>
        <button
          type="button"
          onClick={() => pop.setAbierto(!pop.abierto)}
          aria-expanded={pop.abierto}
          aria-haspopup="dialog"
          aria-label={`${texto}. ${descripcion}`}
          className={`flex h-11 ${ancho} items-center justify-center gap-2 border-x border-line px-3 text-sm font-semibold tabular-nums transition-colors hover:bg-hover active:bg-press ${
            pop.abierto ? 'bg-hover' : ''
          }`}
        >
          <CalendarDays size={15} className="text-muted" aria-hidden="true" />
          <span className="first-letter:uppercase">{texto}</span>
        </button>
        <IconButton label={etiquetaSiguiente} onClick={onSiguiente} className="rounded-l-none">
          <ChevronRight size={18} />
        </IconButton>
      </div>
      {pop.abierto && (
        <div
          role="dialog"
          aria-label={descripcion}
          className="absolute top-[calc(100%+6px)] left-0 z-40 w-[304px] animate-pop-in rounded-2xl border border-line bg-card p-3 shadow-pop"
        >
          {panel}
        </div>
      )}
    </div>
  )
}

function CabeceraPanel({ titulo, onAnterior, onSiguiente, anterior, siguiente }: { titulo: string; onAnterior: () => void; onSiguiente: () => void; anterior: string; siguiente: string }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <IconButton size="sm" label={anterior} onClick={onAnterior}>
        <ChevronLeft size={17} />
      </IconButton>
      <span className="text-sm font-semibold">{titulo}</span>
      <IconButton size="sm" label={siguiente} onClick={onSiguiente}>
        <ChevronRight size={17} />
      </IconButton>
    </div>
  )
}

/**
 * Elegir una semana (lunes a domingo). Las flechas mueven de a una semana;
 * tocando las fechas se abre un calendario donde se elige la semana entera.
 */
export function SelectorSemana({ lunes, onChange, hoy }: { lunes: string; onChange: (lunes: string) => void; hoy: string }) {
  const pop = usePopover()
  // Mes que se ve en el calendario
  const [vista, setVista] = useState(() => lunes.slice(0, 7))
  useEffect(() => {
    if (pop.abierto) setVista(addDays(lunes, 3).slice(0, 7)) // el jueves define el mes de la semana
  }, [pop.abierto, lunes])

  const [y, m] = vista.split('-').map(Number)
  const primero = toISO(new Date(y, m - 1, 1))
  const ultimo = toISO(new Date(y, m, 0))
  const semanas: string[] = []
  for (let l = lunesDe(primero); l <= ultimo; l = addDays(l, 7)) semanas.push(l)
  const lunesHoy = lunesDe(hoy)

  const elegir = (l: string) => {
    onChange(l)
    pop.setAbierto(false)
  }

  return (
    <Marco
      pop={pop}
      etiquetaAnterior="Semana anterior"
      etiquetaSiguiente="Semana siguiente"
      onAnterior={() => onChange(addDays(lunes, -7))}
      onSiguiente={() => onChange(addDays(lunes, 7))}
      texto={rangoSemana(lunes)}
      ancho="min-w-[132px]"
      descripcion="Elegir semana"
      panel={
        <>
          <CabeceraPanel
            titulo={`${NOMBRE_MES[m - 1]} ${y}`}
            anterior="Mes anterior"
            siguiente="Mes siguiente"
            onAnterior={() => setVista(moverMes(vista, -1))}
            onSiguiente={() => setVista(moverMes(vista, 1))}
          />
          <div className="grid grid-cols-7 px-1 pb-1">
            {DIAS_LETRA.map((d) => (
              <span key={d} className="py-1 text-center text-[11px] font-medium text-faint">
                {d}
              </span>
            ))}
          </div>
          <div role="listbox" aria-label="Semanas" className="flex flex-col gap-0.5">
            {semanas.map((l) => {
              const on = l === lunes
              const actual = l === lunesHoy
              return (
                <button
                  key={l}
                  type="button"
                  role="option"
                  aria-selected={on}
                  aria-label={`Semana del ${rangoSemana(l)}${actual ? ' (esta semana)' : ''}`}
                  onClick={() => elegir(l)}
                  autoFocus={on}
                  className={`grid h-9 grid-cols-7 rounded-xl px-1 transition-colors ${on ? 'bg-olive text-white' : 'hover:bg-olive-soft active:bg-olive-line'}`}
                >
                  {Array.from({ length: 7 }, (_, i) => {
                    const f = addDays(l, i)
                    const fuera = f.slice(0, 7) !== vista
                    const esHoy = f === hoy
                    return (
                      <span
                        key={f}
                        className={`flex items-center justify-center font-mono text-[13px] ${
                          on ? (fuera ? 'text-white/55' : 'font-semibold') : fuera ? 'text-faint' : 'text-ink'
                        }`}
                      >
                        <span className={`flex size-7 items-center justify-center rounded-full ${esHoy ? (on ? 'ring-1 ring-white/70' : 'font-semibold text-olive ring-1 ring-olive/50') : ''}`}>
                          {Number(f.slice(8))}
                        </span>
                      </span>
                    )
                  })}
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-divider pt-2">
            <span className="px-1 text-[11px] text-muted">Se elige la semana completa</span>
            <button
              type="button"
              onClick={() => elegir(lunesHoy)}
              className="rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-olive transition-colors hover:bg-olive-soft active:bg-olive-line"
            >
              Esta semana
            </button>
          </div>
        </>
      }
    />
  )
}

/** Elegir un mes: flechas de a un mes, o tocando el nombre se abre la grilla del año. */
export function SelectorMes({ mes, onChange, mesActual }: { mes: string; onChange: (mes: string) => void; mesActual: string }) {
  const pop = usePopover()
  const [anio, setAnio] = useState(() => Number(mes.slice(0, 4)))
  useEffect(() => {
    if (pop.abierto) setAnio(Number(mes.slice(0, 4)))
  }, [pop.abierto, mes])

  const elegir = (m: string) => {
    onChange(m)
    pop.setAbierto(false)
  }

  return (
    <Marco
      pop={pop}
      etiquetaAnterior="Mes anterior"
      etiquetaSiguiente="Mes siguiente"
      onAnterior={() => onChange(moverMes(mes, -1))}
      onSiguiente={() => onChange(moverMes(mes, 1))}
      texto={nombreMes(mes)}
      ancho="min-w-[170px]"
      descripcion="Elegir mes"
      panel={
        <>
          <CabeceraPanel titulo={String(anio)} anterior="Año anterior" siguiente="Año siguiente" onAnterior={() => setAnio(anio - 1)} onSiguiente={() => setAnio(anio + 1)} />
          <div role="listbox" aria-label="Meses" className="grid grid-cols-3 gap-1.5">
            {MESES_CORTOS.map((nombre, i) => {
              const valor = `${anio}-${String(i + 1).padStart(2, '0')}`
              const on = valor === mes
              const actual = valor === mesActual
              return (
                <button
                  key={valor}
                  type="button"
                  role="option"
                  aria-selected={on}
                  aria-label={`${NOMBRE_MES[i]} ${anio}${actual ? ' (este mes)' : ''}`}
                  autoFocus={on}
                  onClick={() => elegir(valor)}
                  className={`h-11 rounded-xl text-sm font-medium transition-colors ${
                    on ? 'bg-olive font-semibold text-white' : actual ? 'text-olive ring-1 ring-olive/40 ring-inset hover:bg-olive-soft' : 'text-ink hover:bg-olive-soft active:bg-olive-line'
                  }`}
                >
                  {nombre}
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex justify-end border-t border-divider pt-2">
            <button
              type="button"
              onClick={() => elegir(mesActual)}
              className="rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-olive transition-colors hover:bg-olive-soft active:bg-olive-line"
            >
              Este mes
            </button>
          </div>
        </>
      }
    />
  )
}
