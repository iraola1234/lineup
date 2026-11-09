/**
 * Fechas como texto "YYYY-MM-DD" (igual que la columna `date` de Postgres).
 * Se opera en hora local para no tener corrimientos por zona horaria.
 */

const pad = (n: number) => String(n).padStart(2, '0')

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: string, n: number): string {
  const d = parseISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export const hoyISO = () => toISO(new Date())

/** Lunes de la semana de esa fecha (la semana va de lunes a domingo). */
export function lunesDe(s: string): string {
  const dow = (parseISO(s).getDay() + 6) % 7 // lunes = 0
  return addDays(s, -dow)
}

export function diasDeSemana(lunes: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(lunes, i))
}

export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const DIAS_ABR = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
export const DIAS_LETRA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export const indiceDia = (s: string) => (parseISO(s).getDay() + 6) % 7
export const numeroDia = (s: string) => parseISO(s).getDate()

/** "Lunes 14 de diciembre" */
export function fechaLarga(s: string): string {
  const d = parseISO(s)
  return `${DIAS[indiceDia(s)]} ${d.getDate()} de ${MESES[d.getMonth()]}`
}

/** "Lun 14" */
export function fechaCorta(s: string): string {
  return `${DIAS_ABR[indiceDia(s)]} ${numeroDia(s)}`
}

/** "14 – 20 dic" o "28 dic – 3 ene" */
export function rangoSemana(lunes: string): string {
  const a = parseISO(lunes)
  const b = parseISO(addDays(lunes, 6))
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${b.getDate()} ${MESES_ABR[b.getMonth()]}`
  return `${a.getDate()} ${MESES_ABR[a.getMonth()]} – ${b.getDate()} ${MESES_ABR[b.getMonth()]}`
}

/** Jornada en curso: hasta las 6 de la mañana se sigue cerrando el día anterior. */
export function jornadaActual(): string {
  const d = new Date()
  return d.getHours() < 6 ? addDays(toISO(d), -1) : toISO(d)
}
