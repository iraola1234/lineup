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

export type DiaPropina = {
  fecha: string
  monto: number
  /** Horas reales de ese día de quienes participan. */
  horas: number
  /** Pesos por hora trabajada ese día. */
  valorHora: number
  /** Cuántas personas se reparten la propina de ese día. */
  personas: number
}

export type PersonaPropina = {
  horas: number
  parte: number
  /** Lo que le tocó cada día (fecha → horas y pesos). */
  porDia: Map<string, { horas: number; parte: number }>
}

export type RepartoSemana = {
  /** Suma de la semana. */
  total: number
  /** Propina de días en los que nadie que participa trabajó (no se puede repartir). */
  sinRepartir: number
  horas: number
  dias: DiaPropina[]
  personas: Map<string, PersonaPropina>
}

/**
 * La propina se carga por día y se reparte ese mismo día entre quienes trabajaron,
 * por igual por hora real (el ausente no suma). A cada persona se le paga la suma
 * de la semana.
 */
export function repartirPorDia(
  dias: string[],
  montos: Map<string, number>,
  turnos: Asignacion[],
  participa: (empleadoId: string) => boolean,
): RepartoSemana {
  const personas = new Map<string, PersonaPropina>()
  const resumen: DiaPropina[] = []
  let sinRepartir = 0
  for (const fecha of dias) {
    const monto = montos.get(fecha) ?? 0
    const horasDia = new Map<string, number>()
    for (const a of turnos) {
      if (a.fecha_jornada !== fecha || !participa(a.empleado_id)) continue
      const h = horasReales(a)
      if (h > 0) horasDia.set(a.empleado_id, (horasDia.get(a.empleado_id) ?? 0) + h)
    }
    const horas = [...horasDia.values()].reduce((s, h) => s + h, 0)
    const valorHora = horas > 0 ? monto / horas : 0
    if (monto > 0 && horas === 0) sinRepartir += monto
    resumen.push({ fecha, monto, horas, valorHora, personas: horasDia.size })
    for (const [id, h] of horasDia) {
      const p = personas.get(id) ?? { horas: 0, parte: 0, porDia: new Map() }
      const parte = h * valorHora
      p.horas += h
      p.parte += parte
      p.porDia.set(fecha, { horas: h, parte })
      personas.set(id, p)
    }
  }
  for (const p of personas.values()) p.parte = Math.round(p.parte * 100) / 100
  return {
    total: resumen.reduce((s, d) => s + d.monto, 0),
    sinRepartir,
    horas: resumen.reduce((s, d) => s + d.horas, 0),
    dias: resumen,
    personas,
  }
}

const fmt = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 })
/** 12345.6 → "$ 12.346" */
export const fmtPesos = (n: number) => `$ ${fmt.format(Math.round(n))}`

/** Montos de cada día de la semana y pagos registrados. */
export function usePropinaSemana(localId: string, lunes: string, domingo: string) {
  const [montos, setMontos] = useState<Map<string, number>>(new Map())
  const [pagos, setPagos] = useState<PagoPropina[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!supabase) return
    const [m, p] = await Promise.all([
      supabase.from('propinas_dia').select('fecha, monto').eq('local_id', localId).gte('fecha', lunes).lte('fecha', domingo),
      supabase.from('pagos_propina').select('*').eq('local_id', localId).eq('lunes', lunes),
    ])
    if (m.error || p.error) setError('No se pudo cargar la propina.')
    else {
      setMontos(new Map((m.data ?? []).map((x) => [x.fecha as string, Number(x.monto)])))
      setPagos(((p.data ?? []) as PagoPropina[]).map((x) => ({ ...x, monto: Number(x.monto) })))
      setError(null)
    }
    setLoading(false)
  }, [localId, lunes, domingo])

  useEffect(() => {
    setLoading(true)
    setMontos(new Map())
    setPagos([])
    reload()
  }, [reload])

  /** Guarda (o borra, si es 0) la propina de un día. */
  const guardarDia = async (fecha: string, n: number) => {
    if (!supabase) return false
    const antes = montos
    const next = new Map(montos)
    if (n > 0) next.set(fecha, n)
    else next.delete(fecha)
    setMontos(next)
    const { error } =
      n > 0
        ? await supabase.from('propinas_dia').upsert({ local_id: localId, fecha, monto: n, actualizado_en: new Date().toISOString() }, { onConflict: 'local_id,fecha' })
        : await supabase.from('propinas_dia').delete().eq('local_id', localId).eq('fecha', fecha)
    if (error) setMontos(antes)
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

  return { montos, pagos, loading, error, reload, guardarDia, marcarPagados, desmarcar }
}
