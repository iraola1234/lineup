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

export type Asignacion = {
  id: string
  local_id: string
  empleado_id: string
  fecha_jornada: string // "YYYY-MM-DD", día en que empieza el turno
  tipo_turno_id: string | null // null = turno "Otro"
  nombre_turno: string
  color: string
  inicio_plan: string
  fin_plan: string
  horas_plan: number
  horas_reales: number | null
  ausente: boolean
  momento: Momento
}

/** Momento del turno: junto con el área de la persona define la división (Salón día, Cocina noche…). */
export type Momento = 'dia' | 'noche'

export type Division = { area_id: string; momento: Momento }

/** Cierre de una división en un día. Quién y cuándo lo pone la base. */
export type CierreDivision = Division & {
  local_id: string
  fecha: string
  confirmado: boolean
  confirmado_en: string | null
  confirmado_por: string | null
}

export type Rol = 'admin' | 'encargado'

export type Miembro = {
  usuario_id: string
  local_id: string
  rol: Rol
  email: string | null
  nombre: string
}

export type Invitacion = {
  id: string
  local_id: string
  email: string
  nombre: string
  rol: Rol
  divisiones: Division[]
  creado_en: string
}

/** Qué asignarle a una persona en un día: un tipo de turno, un horario a mano, o nada (libre). */
export type OpcionTurno = { tipo: TipoTurno } | { otro: { inicio: string; fin: string } } | null

export type TipoTurno = {
  id: string
  local_id: string
  nombre: string
  inicio: string // "HH:MM:SS"
  fin: string
  color: string // clave de paleta (ver colors.ts)
  orden: number
  archivado: boolean
  momento: Momento
}
