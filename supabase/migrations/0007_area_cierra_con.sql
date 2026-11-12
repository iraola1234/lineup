-- =============================================================
-- 0007 · Un área puede confirmarse junto con otra
--
-- Ej.: Barra no tiene encargado propio; sus horas las confirma el
-- encargado de Salón. Entonces la división de un turno de Barra de
-- noche es "Salón noche". Solo un nivel (el área destino no puede
-- a su vez depender de otra).
-- =============================================================

alter table public.areas
  add column if not exists cierra_con uuid references public.areas (id) on delete set null;
alter table public.areas
  add constraint areas_cierra_con_distinta check (cierra_con is null or cierra_con <> id);
create index if not exists areas_cierra_con_idx on public.areas (cierra_con);

-- Área con la que se confirma (ella misma si no depende de otra)
create or replace function public.area_de_cierre(p_area uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(cierra_con, id) from public.areas where id = p_area;
$$;
revoke all on function public.area_de_cierre(uuid) from public, anon;
grant execute on function public.area_de_cierre(uuid) to authenticated;

-- Un solo nivel y dentro del mismo local
create or replace function public.validar_cierra_con()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.cierra_con is not null then
    if not exists (select 1 from areas where id = new.cierra_con and local_id = new.local_id and cierra_con is null) then
      raise exception 'El área elegida no es válida';
    end if;
    if exists (select 1 from areas where cierra_con = new.id) then
      raise exception 'Otra área se confirma con esta: no puede depender de otra';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists validar_cierra_con on public.areas;
create trigger validar_cierra_con before insert or update of cierra_con on public.areas
  for each row execute function public.validar_cierra_con();

-- Las divisiones asignadas a un área que ahora depende de otra ya no aplican
create or replace function public.limpiar_divisiones_area()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cierra_con is not null then
    delete from miembro_divisiones where area_id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists limpiar_divisiones_area on public.areas;
create trigger limpiar_divisiones_area after update of cierra_con on public.areas
  for each row execute function public.limpiar_divisiones_area();

-- Corregir horas: la división se toma del área de cierre
create or replace function public.corregir_turno(p_id uuid, p_horas_reales numeric, p_ausente boolean)
returns public.asignaciones
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a    asignaciones;
  v_area uuid;
begin
  select * into v_a from asignaciones where id = p_id;
  if not found then
    raise exception 'El turno ya no existe';
  end if;
  select public.area_de_cierre(area_id) into v_area from empleados where id = v_a.empleado_id;
  if not public.puede_cerrar(v_a.local_id, v_area, v_a.momento) then
    raise exception 'Esta división la confirma otro encargado';
  end if;
  if exists (
    select 1 from cierres_division
     where local_id = v_a.local_id and fecha = v_a.fecha_jornada and area_id = v_area
       and momento = v_a.momento and confirmado
  ) then
    raise exception 'El día ya está confirmado: reabrilo para corregir';
  end if;

  update asignaciones set horas_reales = p_horas_reales, ausente = coalesce(p_ausente, false)
   where id = p_id
  returning * into v_a;
  return v_a;
end;
$$;

-- Cambiar horarios reabre la división de cierre que corresponde
create or replace function public.reemplazar_turnos(
  p_local    uuid,
  p_desde    date,
  p_hasta    date,
  p_empleado uuid  default null,
  p_filas    jsonb default '[]'::jsonb
)
returns setof public.asignaciones
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.es_admin(p_local) then
    raise exception 'Solo el administrador puede cambiar horarios';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_filas) as f(fecha_jornada date, empleado_id uuid)
    where f.fecha_jornada not between p_desde and p_hasta
       or (p_empleado is not null and f.empleado_id <> p_empleado)
  ) then
    raise exception 'Hay turnos fuera del rango indicado';
  end if;

  with antes as (
    select a.fecha_jornada, a.empleado_id, a.inicio_plan, a.fin_plan, a.momento,
           a.horas_reales, a.ausente
      from asignaciones a
     where a.local_id = p_local and a.fecha_jornada between p_desde and p_hasta
       and (p_empleado is null or a.empleado_id = p_empleado)
  ), despues as (
    select f.fecha_jornada, f.empleado_id, f.inicio_plan, f.fin_plan,
           coalesce(f.momento, public.momento_por_hora(f.inicio_plan)) as momento,
           f.horas_reales::numeric(4,2) as horas_reales, coalesce(f.ausente, false) as ausente
      from jsonb_to_recordset(p_filas) as f(
        empleado_id uuid, fecha_jornada date, inicio_plan time, fin_plan time,
        momento text, horas_reales numeric, ausente boolean)
  ), cambios as (
    (select * from antes except all select * from despues)
    union all
    (select * from despues except all select * from antes)
  )
  update cierres_division c
     set confirmado = false, confirmado_en = null, confirmado_por = null
    from cambios x
    join empleados e on e.id = x.empleado_id
    join areas ar on ar.id = e.area_id
   where c.local_id = p_local and c.confirmado
     and c.fecha = x.fecha_jornada and c.area_id = coalesce(ar.cierra_con, ar.id) and c.momento = x.momento;

  delete from asignaciones
   where local_id = p_local
     and fecha_jornada between p_desde and p_hasta
     and (p_empleado is null or empleado_id = p_empleado);

  return query
  insert into asignaciones
    (local_id, empleado_id, fecha_jornada, tipo_turno_id, nombre_turno, color,
     inicio_plan, fin_plan, momento, horas_reales, ausente)
  select p_local, f.empleado_id, f.fecha_jornada, f.tipo_turno_id, f.nombre_turno, f.color,
         f.inicio_plan, f.fin_plan, coalesce(f.momento, public.momento_por_hora(f.inicio_plan)),
         f.horas_reales, coalesce(f.ausente, false)
    from jsonb_to_recordset(p_filas) as f(
      empleado_id uuid, fecha_jornada date, tipo_turno_id uuid, nombre_turno text,
      color text, inicio_plan time, fin_plan time, momento text, horas_reales numeric, ausente boolean
    )
  returning *;
end;
$$;

-- Barra se confirma con Salón (en los locales que tengan ambas)
update public.areas b
   set cierra_con = s.id
  from public.areas s
 where b.local_id = s.local_id
   and lower(b.nombre) = 'barra' and lower(s.nombre) in ('salón', 'salon')
   and b.cierra_con is null;
