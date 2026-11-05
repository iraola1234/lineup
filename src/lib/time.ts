/** "09:00:00" → "09:00" */
export function hhmm(t: string): string {
  return t.slice(0, 5)
}

/** "17:30" → 17.5 */
export function toHours(t: string): number {
  const [h, m] = t.split(':').map((x) => parseInt(x, 10) || 0)
  return h + m / 60
}

/** Duración de un turno en horas; si cruza medianoche suma 24 h. 17:00–01:00 → 8. */
export function duracion(inicio: string, fin: string): number {
  const d = (toHours(fin) - toHours(inicio) + 24) % 24
  return d === 0 ? 24 : d
}

/** 7.5 → "7,5 h" */
export function fmtHoras(h: number): string {
  return `${String(Math.round(h * 10) / 10).replace('.', ',')} h`
}

/** "09:00:00" → "09" o "09:30" (formato corto para etiquetas) */
export function corta(t: string): string {
  const s = hhmm(t)
  return s.endsWith(':00') ? s.slice(0, 2) : s
}
