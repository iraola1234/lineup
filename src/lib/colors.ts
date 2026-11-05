/** Paleta de colores para turnos. La clave se guarda en la base (tipos_turno.color). */
export type TurnoColor = { label: string; bg: string; fg: string; bd: string }

export const TURNO_COLORS: Record<string, TurnoColor> = {
  manana: { label: 'Ámbar', bg: '#FBEFD9', fg: '#8A5A12', bd: '#F1D9AE' },
  tarde: { label: 'Verde', bg: '#E8EEDF', fg: '#475733', bd: '#CFDBBE' },
  noche: { label: 'Oliva', bg: '#55624A', fg: '#FFFFFF', bd: '#55624A' },
  azul: { label: 'Azul', bg: '#E2EAF1', fg: '#2F4A60', bd: '#C7D6E3' },
  lila: { label: 'Lila', bg: '#ECE6F1', fg: '#5B4570', bd: '#D8CCE3' },
  arena: { label: 'Arena', bg: '#EFEDE8', fg: '#4A4943', bd: '#DAD7CE' },
  especial: { label: 'Rojo', bg: '#F9E3DF', fg: '#A33A2C', bd: '#F0C6BE' },
}

export const COLOR_KEYS = Object.keys(TURNO_COLORS)

export function turnoColor(key: string): TurnoColor {
  return TURNO_COLORS[key] ?? TURNO_COLORS.arena
}
