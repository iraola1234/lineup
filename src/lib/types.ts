export type Local = {
  id: string
  nombre: string
}

export type Area = {
  id: string
  local_id: string
  nombre: string
  orden: number
}

export type Empleado = {
  id: string
  local_id: string
  area_id: string
  nombre: string
  puesto: string
  horas_contrato_semana: number
  participa_propina: boolean
  valor_hora: number | null
  activo: boolean
  orden: number
}

export type TipoTurno = {
  id: string
  local_id: string
  nombre: string
  inicio: string // "HH:MM:SS"
  fin: string
  color: string // clave de paleta (ver colors.ts)
  orden: number
  archivado: boolean
}
