import { useCallback, useEffect, useState } from 'react'
import { horasReales } from './semana'
import { supabase } from './supabase'
import type { Asignacion } from './types'

export type PagoPropina = {
  local_id: string
  lunes: string
  empleado_id: string
  monto: number
  pagado_en: string
  pagado_por: string | null
}

export type RepartoSemana = {
  monto: number
  /** Horas reales de la semana de quienes participan. */
  horas: number
  /** Pesos por hora trabajada. */
  valorHora: number
  /** Horas y parte de cada persona (empleado_id → …). */
  personas: Map<string, { horas: number; parte: number }>
}

/**
 * Reparto semanal: el monto de la semana se divide por igual por hora trabajada
 * entre quienes participan. Las horas son las reales (el ausente no suma).
 */
export function repartirSemana(monto: number, turnos: Asignacion[], participa: (empleadoId: string) => boolean): RepartoSemana {
  const horasPorPersona = new Map<string, number>()
  for (const a of turnos) {
    if (!participa(a.empleado_id)) continue
    const h = horasReales(a)
    if (h > 0) horasPorPersona.set(a.empleado_id, (horasPorPersona.get(a.empleado_id) ?? 0) + h)
  }
  const horas = [...horasPorPersona.values()].reduce((s, h) => s + h, 0)
  const valorHora = horas > 0 ? monto / horas : 0
  const personas = new Map([...horasPorPersona].map(([id, h]) => [id, { horas: h, parte: Math.round(h * valorHora * 100) / 100 }]))
  return { monto, horas, valorHora, personas }
}

const fmt = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 })
/** 12345.6 → "$ 12.346" */
export const fmtPesos = (n: number) => `$ ${fmt.format(Math.round(n))}`

/** Monto de la semana y pagos registrados. */
export function usePropinaSemana(localId: string, lunes: string) {
  const [monto, setMonto] = useState<number | null>(null)
  const [pagos, setPagos] = useState<PagoPropina[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!supabase) return
    const [m, p] = await Promise.all([
      supabase.from('propinas_semana').select('monto').eq('local_id', localId).eq('lunes', lunes).maybeSingle(),
      supabase.from('pagos_propina').select('*').eq('local_id', localId).eq('lunes', lunes),
    ])
    if (m.error || p.error) setError('No se pudo cargar la propina.')
    else {
      setMonto(m.data ? Number(m.data.monto) : null)
      setPagos(((p.data ?? []) as PagoPropina[]).map((x) => ({ ...x, monto: Number(x.monto) })))
      setError(null)
    }
    setLoading(false)
  }, [localId, lunes])

  useEffect(() => {
    setLoading(true)
    setMonto(null)
    setPagos([])
    reload()
  }, [reload])

  const guardarMonto = async (n: number) => {
    if (!supabase) return false
    const antes = monto
    setMonto(n)
    const { error } = await supabase.from('propinas_semana').upsert({ local_id: localId, lunes, monto: n, actualizado_en: new Date().toISOString() }, { onConflict: 'local_id,lunes' })
    if (error) setMonto(antes)
    return !error
  }

  const marcarPagados = async (filas: { empleado_id: string; monto: number }[]) => {
    if (!supabase || filas.length === 0) return true
    const ahora = new Date().toISOString()
    const nuevos = filas.map((f) => ({ local_id: localId, lunes, empleado_id: f.empleado_id, monto: f.monto, pagado_en: ahora, pagado_por: null }))
    const antes = pagos
    setPagos([...pagos.filter((p) => !filas.some((f) => f.empleado_id === p.empleado_id)), ...nuevos])
    const { data: u } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('pagos_propina')
      .upsert(nuevos.map((n) => ({ ...n, pagado_por: u.user?.id ?? null })), { onConflict: 'local_id,lunes,empleado_id' })
    if (error) setPagos(antes)
    return !error
  }

  const desmarcar = async (empleadoIds: string[]) => {
    if (!supabase || empleadoIds.length === 0) return true
    const antes = pagos
    setPagos(pagos.filter((p) => !empleadoIds.includes(p.empleado_id)))
    const { error } = await supabase.from('pagos_propina').delete().eq('local_id', localId).eq('lunes', lunes).in('empleado_id', empleadoIds)
    if (error) setPagos(antes)
    return !error
  }

  return { monto, pagos, loading, error, reload, guardarMonto, marcarPagados, desmarcar }
}
