import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Asignacion, DiaCierre } from './types'
import { toISO } from './fechas'

export type PropinaDia = { local_id: string; fecha: string; monto: number }
export type DatosMes = { asignaciones: Asignacion[]; cierres: DiaCierre[]; propinas: PropinaDia[] }

/** "2026-11" → primer y último día del mes */
export function limitesMes(mes: string): { desde: string; hasta: string } {
  const [y, m] = mes.split('-').map(Number)
  return { desde: `${mes}-01`, hasta: toISO(new Date(y, m, 0)) }
}

export function moverMes(mes: string, n: number): string {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
/** "2026-11" → "noviembre 2026" */
export const nombreMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`

const cache = new Map<string, DatosMes>()

/** Turnos, cierres y propinas de un mes (por fecha de jornada). */
export function useMes(localId: string, mes: string) {
  const key = `${localId}|${mes}`
  const [datos, setDatos] = useState<DatosMes | null>(() => cache.get(key) ?? null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!supabase) return
    const { desde, hasta } = limitesMes(mes)
    const [a, c, p] = await Promise.all([
      supabase.from('asignaciones').select('*').eq('local_id', localId).gte('fecha_jornada', desde).lte('fecha_jornada', hasta).order('fecha_jornada').order('inicio_plan'),
      supabase.from('dias_cierre').select('*').eq('local_id', localId).gte('fecha', desde).lte('fecha', hasta),
      supabase.from('propinas_dia').select('*').eq('local_id', localId).gte('fecha', desde).lte('fecha', hasta),
    ])
    if (a.error || c.error || p.error) {
      setError('No se pudo cargar el mes.')
      return
    }
    const d: DatosMes = {
      asignaciones: a.data as Asignacion[],
      cierres: c.data as DiaCierre[],
      propinas: (p.data as PropinaDia[]).map((x) => ({ ...x, monto: Number(x.monto) })),
    }
    cache.set(key, d)
    setDatos(d)
    setError(null)
  }, [localId, mes, key])

  useEffect(() => {
    setDatos(cache.get(key) ?? null)
    reload()
  }, [key, reload])

  return { datos, loading: datos === null && !error, error, reload }
}
