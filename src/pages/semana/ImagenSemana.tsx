import { forwardRef } from 'react'
import { TURNO_COLORS, turnoColor } from '../../lib/colors'
import { fechaCorta, rangoSemana } from '../../lib/fechas'
import { corta } from '../../lib/time'
import type { Area, Asignacion, Empleado, TipoTurno } from '../../lib/types'
import { porArea, rango } from './helpers'

type Props = {
  localNombre: string
  lunes: string
  dias: string[]
  areas: Area[]
  empleados: Empleado[]
  tipos: TipoTurno[]
  asignaciones: Asignacion[]
  turnosDe: (empleadoId: string, fecha: string) => Asignacion[]
}

const SANS = "'Geist', system-ui, sans-serif"
const MONO = "'Geist Mono', ui-monospace, monospace"
const COL_NOMBRE = 210

/**
 * La imagen que se manda al grupo: columnas = días, filas = empleados por área.
 * Estilos en línea y ancho fijo (1080 px) para que la imagen salga igual en cualquier pantalla.
 */
export const ImagenSemana = forwardRef<HTMLDivElement, Props>(function ImagenSemana(
  { localNombre, lunes, dias, areas, empleados, tipos, asignaciones, turnosDe },
  ref,
) {
  const usados = new Set(asignaciones.map((a) => a.tipo_turno_id ?? 'otro'))
  const leyenda = [
    ...tipos.filter((t) => usados.has(t.id)).map((t) => ({ nombre: t.nombre, hora: `${corta(t.inicio)}–${corta(t.fin)}`, c: turnoColor(t.color) })),
    ...(usados.has('otro') ? [{ nombre: 'Especial', hora: 'horario indicado', c: TURNO_COLORS.especial }] : []),
  ]
  const grid = `${COL_NOMBRE}px repeat(7, minmax(0, 1fr))`

  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        boxSizing: 'border-box',
        padding: 40,
        background: '#FFFFFF',
        color: '#1C1D1A',
        fontFamily: SANS,
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6A63' }}>
            {localNombre}
          </span>
          <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.01em' }}>Horarios · semana {rangoSemana(lunes)}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '8px 16px', maxWidth: 480 }}>
          {leyenda.map((l) => (
            <span key={l.nombre} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: l.c.bg, border: `1px solid ${l.c.bd}` }} />
              <span style={{ fontWeight: 600 }}>{l.nombre}</span>
              <span style={{ fontFamily: MONO, color: '#6B6A63' }}>{l.hora}</span>
            </span>
          ))}
        </div>
      </div>

      <div style={{ border: '1px solid #E7E5DF', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: grid, background: '#55624A', color: '#FFFFFF' }}>
          <div style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600 }}>Equipo</div>
          {dias.map((d) => (
            <div key={d} style={{ padding: '12px 4px', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
              {fechaCorta(d)}
            </div>
          ))}
        </div>
        {porArea(areas, empleados).map(({ area, empleados: lista }) => (
          <div key={area.id}>
            <div
              style={{
                padding: '9px 16px',
                background: '#F3F2EE',
                borderTop: '1px solid #E7E5DF',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#55544E',
              }}
            >
              {area.nombre}
            </div>
            {lista.map((e) => (
              <div
                key={e.id}
                style={{ display: 'grid', gridTemplateColumns: grid, alignItems: 'center', borderTop: '1px solid #EFEDE8' }}
              >
                <div style={{ padding: '7px 16px', display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {e.nombre}
                  </span>
                  <span style={{ fontSize: 12, color: '#6B6A63' }}>{e.puesto}</span>
                </div>
                {dias.map((d) => {
                  const turnos = turnosDe(e.id, d)
                  return (
                    <div key={d} style={{ padding: '5px 4px', height: 50, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {turnos.map((a) => {
                        const c = turnoColor(a.color)
                        return (
                          <div
                            key={a.id}
                            style={{
                              flex: 1,
                              borderRadius: 8,
                              background: c.bg,
                              color: c.fg,
                              border: `1px solid ${c.bd}`,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              lineHeight: 1.15,
                            }}
                          >
                            {turnos.length === 1 && <span style={{ fontSize: 12, fontWeight: 700 }}>{a.nombre_turno}</span>}
                            <span style={{ fontSize: 11, fontFamily: MONO, fontWeight: 500 }}>{rango(a)}</span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
      <span style={{ fontSize: 13, color: '#6B6A63' }}>Casillero vacío = día libre. Cualquier cambio, avisar al encargado.</span>
    </div>
  )
})
