-- =============================================================
-- Lineup · 0003 · cambios de turnos en un solo paso
-- Pegar en Supabase → SQL Editor → Run (después de 0002).
--
-- Antes, cada cambio eran 2–3 pedidos a la base (borrar, insertar,
-- recargar). Ahora es uno solo y atómico: o se aplica todo o nada.
-- Lo usan asignar, mover, copiar, restablecer y deshacer.
-- =============================================================

create or replace function public.reemplazar_turnos(
  p_local    uuid,
  p_desde    date,
  p_hasta    date,
  p_empleado uuid  default null,   -- null = todos los empleados del rango
  p_filas    jsonb default '[]'::jsonb
)
returns setof public.asignaciones
language plpgsql
security invoker                    -- corre con los permisos del usuario: aplica RLS
set search_path = public
as $$
begin
  if not public.es_miembro(p_local) then
    raise exception 'Sin acceso a este local';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_filas) as f(fecha_jornada date, empleado_id uuid)
    where f.fecha_jornada not between p_desde and p_hasta
       or (p_empleado is not null and f.empleado_id <> p_empleado)
  ) then
    raise exception 'Hay turnos fuera del rango indicado';
  end if;

  delete from asignaciones
   where local_id = p_local
     and fecha_jornada between p_desde and p_hasta
     and (p_empleado is null or empleado_id = p_empleado);

  -- Si cambian los turnos de un día ya confirmado, vuelve a pendiente.
  update dias_cierre
     set confirmado = false, confirmado_en = null
   where local_id = p_local
     and fecha between p_desde and p_hasta
     and confirmado;

  return query
  insert into asignaciones
    (local_id, empleado_id, fecha_jornada, tipo_turno_id, nombre_turno, color,
     inicio_plan, fin_plan, horas_reales, ausente)
  select p_local, f.empleado_id, f.fecha_jornada, f.tipo_turno_id, f.nombre_turno, f.color,
         f.inicio_plan, f.fin_plan, f.horas_reales, coalesce(f.ausente, false)
    from jsonb_to_recordset(p_filas) as f(
      empleado_id uuid, fecha_jornada date, tipo_turno_id uuid, nombre_turno text,
      color text, inicio_plan time, fin_plan time, horas_reales numeric, ausente boolean
    )
  returning *;
end;
$$;

revoke all on function public.reemplazar_turnos(uuid, date, date, uuid, jsonb) from public, anon;
grant execute on function public.reemplazar_turnos(uuid, date, date, uuid, jsonb) to authenticated;
