import type { Area, Division, Momento } from './types'

export const MOMENTOS: Momento[] = ['dia', 'noche']

/** Todas las divisiones del local: cada área con encargado propio, de día y de noche. */
export function todasLasDivisiones(areas: Area[]): Division[] {
  return areas.filter((a) => !a.cierra_con).flatMap((a) => MOMENTOS.map((momento) => ({ area_id: a.id, momento })))
}

/** Área con la que se confirman las horas (Barra → Salón). */
export function areaDeCierre(areas: Area[], areaId: string | undefined): string | undefined {
  if (!areaId) return undefined
  return areas.find((a) => a.id === areaId)?.cierra_con ?? areaId
}

/** "Salón noche" */
export function nombreDivision(areas: Area[], d: Division): string {
  const area = areas.find((a) => a.id === d.area_id)?.nombre ?? 'Área'
  return `${area} ${d.momento === 'dia' ? 'día' : 'noche'}`
}

export const mismaDivision = (a: Division, b: Division) => a.area_id === b.area_id && a.momento === b.momento
export const claveDivision = (d: Division) => `${d.area_id}|${d.momento}`
