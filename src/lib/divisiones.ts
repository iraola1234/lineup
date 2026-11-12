import type { Area, Division, Momento } from './types'

export const MOMENTOS: Momento[] = ['dia', 'noche']

/** Todas las divisiones del local: cada área, de día y de noche. */
export function todasLasDivisiones(areas: Area[]): Division[] {
  return areas.flatMap((a) => MOMENTOS.map((momento) => ({ area_id: a.id, momento })))
}

/** "Salón noche" */
export function nombreDivision(areas: Area[], d: Division): string {
  const area = areas.find((a) => a.id === d.area_id)?.nombre ?? 'Área'
  return `${area} ${d.momento === 'dia' ? 'día' : 'noche'}`
}

export const mismaDivision = (a: Division, b: Division) => a.area_id === b.area_id && a.momento === b.momento
export const claveDivision = (d: Division) => `${d.area_id}|${d.momento}`
