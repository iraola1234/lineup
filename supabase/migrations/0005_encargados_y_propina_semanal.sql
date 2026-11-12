-- =============================================================
-- 0005 · Encargados por división y propina semanal
--
-- * Roles: admin (todo) y encargado (ve todo, corrige y confirma
--   solo las horas de su división).
-- * División = área de la persona (Salón / Cocina) × momento del
--   turno (día / noche). El momento sale del tipo de turno; en un
--   turno especial, de la hora de entrada.
-- * El cierre pasa a ser por división y por día.
-- * Propina: un monto por semana y registro de pago por persona.
-- * Invitaciones por email para sumar encargados.
-- =============================================================

-- ---------- Momento del turno ----------
create or replace function public.momento_por_hora(p_inicio time)
returns text
language sql
immutable
set search_path = public
as $$
  select case when p_inicio >= time '16:00' or p_inicio < time '05:00' then 'noche' else 'dia' end;
$$;

alter table public.tipos_turno
  add column if not exists momento text not null default 'dia' check (momento in ('dia', 'noche'));
update public.tipos_turno set momento = public.momento_por_hora(inicio);

alter table public.asignaciones
  add column if not exists momento text not null default 'dia' check (momento in ('dia', 'noche'));
update public.asignaciones a
   set momento = coalesce((select t.momento from public.tipos_turno t where t.id = a.tipo_turno_id), public.momento_por_hora(a.inicio_plan));

-- ---------- Roles ----------
alter table public.miembros drop constraint if exists miembros_rol_check;
update public.miembros set rol = 'admin';   -- quienes ya estaban son dueños de su local
alter table public.miembros add constraint miembros_rol_check check (rol in ('admin', 'encargado'));
alter table public.miembros add column if not exists email text;
alter table public.miembros add column if not exists nombre text not null default '';
update public.miembros m set email = u.email from auth.users u where u.id = m.usuario_id and m.email is null;

create table if not exists public.miembro_divisiones (
  usuario_id uuid not null,
  local_id   uuid not null,
  area_id    uuid not null references public.areas (id) on delete cascade,
  momento    text not null check (momento in ('dia', 'noche')),
  primary key (usuario_id, local_id, area_id, momento),
  foreign key (usuario_id, local_id) references public.miembros (usuario_id, local_id) on delete cascade
);
create index if not exists miembro_divisiones_local_idx on public.miembro_divisiones (local_id);
create index if not exists miembro_divisiones_area_idx on public.miembro_divisiones (area_id);

create or replace function public.es_admin(p_local uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.miembros
    where local_id = p_local and usuario_id = (select auth.uid()) and rol = 'admin'
  );
$$;

-- ¿Puede el usuario corregir y confirmar esta división?
create or replace function public.puede_cerrar(p_local uuid, p_area uuid, p_momento text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_admin(p_local) or exists (
    select 1 from public.miembro_divisiones
    where local_id = p_local and usuario_id = (select auth.uid()) and area_id = p_area and momento = p_momento
  );
$$;

revoke all on function public.es_admin(uuid) from public, anon;
grant execute on function public.es_admin(uuid) to authenticated;
revoke all on function public.puede_cerrar(uuid, uuid, text) from public, anon;
grant execute on function public.puede_cerrar(uuid, uuid, text) to authenticated;

-- ---------- Invitaciones ----------
create table if not exists public.invitaciones (
  id          uuid primary key default gen_random_uuid(),
  local_id    uuid not null references public.locales (id) on delete cascade,
  email       text not null check (email = lower(email)),
  nombre      text not null default '',
  rol         text not null default 'encargado' check (rol in ('admin', 'encargado')),
  divisiones  jsonb not null default '[]'::jsonb,   -- [{"area_id": "...", "momento": "dia"}]
  creado_en   timestamptz not null default now(),
  unique (local_id, email)
);
create index if not exists invitaciones_email_idx on public.invitaciones (email);

-- Al entrar, el usuario toma las invitaciones hechas a su email (ya confirmado).
create or replace function public.aceptar_invitaciones()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_inv   record;
  v_n     int := 0;
begin
  select lower(email) into v_email from auth.users
   where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null then
    return 0;
  end if;

  for v_inv in select * from invitaciones where email = v_email loop
    insert into miembros (usuario_id, local_id, rol, email, nombre)
    values (auth.uid(), v_inv.local_id, v_inv.rol, v_email, v_inv.nombre)
    on conflict (usuario_id, local_id) do update set rol = excluded.rol, nombre = excluded.nombre, email = excluded.email;

    delete from miembro_divisiones where usuario_id = auth.uid() and local_id = v_inv.local_id;
    insert into miembro_divisiones (usuario_id, local_id, area_id, momento)
    select auth.uid(), v_inv.local_id, d.area_id, d.momento
      from jsonb_to_recordset(v_inv.divisiones) as d(area_id uuid, momento text)
      join areas a on a.id = d.area_id and a.local_id = v_inv.local_id
    on conflict do nothing;

    delete from invitaciones where id = v_inv.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.aceptar_invitaciones() from public, anon;
grant execute on function public.aceptar_invitaciones() to authenticated;

-- ---------- Cierre por división ----------
create table if not exists public.cierres_division (
  local_id        uuid not null references public.locales (id) on delete cascade,
  fecha           date not null,
  area_id         uuid not null references public.areas (id) on delete cascade,
  momento         text not null check (momento in ('dia', 'noche')),
  confirmado      boolean not null default false,
  confirmado_en   timestamptz,
  confirmado_por  uuid references auth.users (id) on delete set null,
  primary key (local_id, fecha, area_id, momento)
);
create index if not exists cierres_division_area_idx on public.cierres_division (area_id);
create index if not exists cierres_division_por_idx on public.cierres_division (confirmado_por);

-- Los días ya confirmados quedan confirmados en todas sus divisiones
insert into public.cierres_division (local_id, fecha, area_id, momento, confirmado, confirmado_en)
select d.local_id, d.fecha, a.id, m.momento, true, d.confirmado_en
  from public.dias_cierre d
  join public.areas a on a.local_id = d.local_id
  cross join (values ('dia'), ('noche')) as m (momento)
 where d.confirmado
on conflict do nothing;

-- Quién y cuándo confirmó lo pone la base, no la app
create or replace function public.sellar_cierre()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.confirmado then
    if tg_op = 'INSERT' or not old.confirmado then
      new.confirmado_en := now();
      new.confirmado_por := auth.uid();
    else
      new.confirmado_en := old.confirmado_en;
      new.confirmado_por := old.confirmado_por;
    end if;
  else
    new.confirmado_en := null;
    new.confirmado_por := null;
  end if;
  return new;
end;
$$;
drop trigger if exists sellar_cierre on public.cierres_division;
create trigger sellar_cierre before insert or update on public.cierres_division
  for each row execute function public.sellar_cierre();

-- Corrige horas reales o ausencia de un turno (encargado de esa división o admin; día sin confirmar).
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
  select area_id into v_area from empleados where id = v_a.empleado_id;
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
revoke all on function public.corregir_turno(uuid, numeric, boolean) from public, anon;
grant execute on function public.corregir_turno(uuid, numeric, boolean) to authenticated;

-- ---------- Propina semanal ----------
create table if not exists public.propinas_semana (
  local_id        uuid not null references public.locales (id) on delete cascade,
  lunes           date not null check (extract(isodow from lunes) = 1),
  monto           numeric(12,2) not null default 0 check (monto >= 0),
  actualizado_en  timestamptz not null default now(),
  primary key (local_id, lunes)
);

create table if not exists public.pagos_propina (
  local_id     uuid not null references public.locales (id) on delete cascade,
  lunes        date not null,
  empleado_id  uuid not null references public.empleados (id) on delete restrict,
  monto        numeric(12,2) not null check (monto >= 0),   -- lo que se pagó, tal cual
  pagado_en    timestamptz not null default now(),
  pagado_por   uuid references auth.users (id) on delete set null,
  primary key (local_id, lunes, empleado_id)
);
create index if not exists pagos_propina_empleado_idx on public.pagos_propina (empleado_id);
create index if not exists pagos_propina_por_idx on public.pagos_propina (pagado_por);

-- ---------- Políticas ----------
alter table public.miembro_divisiones enable row level security;
alter table public.invitaciones       enable row level security;
alter table public.cierres_division   enable row level security;
alter table public.propinas_semana    enable row level security;
alter table public.pagos_propina      enable row level security;

-- Locales: todos ven, solo el admin cambia el nombre
drop policy if exists "editar mis locales" on public.locales;
create policy "editar mis locales" on public.locales
  for update using (public.es_admin(id)) with check (public.es_admin(id));

-- Miembros: cada uno se ve a sí mismo; el admin ve y administra a todos
drop policy if exists "ver mis membresias" on public.miembros;
create policy "ver mis membresias" on public.miembros
  for select using (usuario_id = (select auth.uid()) or public.es_admin(local_id));
create policy "admin cambia miembros" on public.miembros
  for update using (public.es_admin(local_id)) with check (public.es_admin(local_id));
create policy "admin quita miembros" on public.miembros
  for delete using (public.es_admin(local_id) and usuario_id <> (select auth.uid()));

create policy "ver divisiones" on public.miembro_divisiones
  for select using (public.es_miembro(local_id));
create policy "admin asigna divisiones" on public.miembro_divisiones
  for all using (public.es_admin(local_id)) with check (public.es_admin(local_id));

create policy "admin invita" on public.invitaciones
  for all using (public.es_admin(local_id)) with check (public.es_admin(local_id));

-- Configuración y horarios: todos ven, solo el admin cambia
do $$
declare t text;
begin
  foreach t in array array['areas', 'empleados', 'tipos_turno', 'asignaciones'] loop
    execute format('drop policy if exists %I on public.%I', case t
      when 'areas' then 'areas del local'
      when 'empleados' then 'empleados del local'
      when 'tipos_turno' then 'tipos de turno del local'
      else 'asignaciones del local' end, t);
    execute format('create policy "ver" on public.%I for select using (public.es_miembro(local_id))', t);
    execute format('create policy "admin inserta" on public.%I for insert with check (public.es_admin(local_id))', t);
    execute format('create policy "admin cambia" on public.%I for update using (public.es_admin(local_id)) with check (public.es_admin(local_id))', t);
    execute format('create policy "admin borra" on public.%I for delete using (public.es_admin(local_id))', t);
  end loop;
end $$;

-- Cierres: todos ven; confirma quien tiene esa división
create policy "ver cierres" on public.cierres_division
  for select using (public.es_miembro(local_id));
create policy "confirmar mi division" on public.cierres_division
  for insert with check (public.puede_cerrar(local_id, area_id, momento));
create policy "reabrir o confirmar mi division" on public.cierres_division
  for update using (public.puede_cerrar(local_id, area_id, momento))
  with check (public.puede_cerrar(local_id, area_id, momento));

-- Propinas: todos ven; solo el admin carga montos y pagos
create policy "ver propinas" on public.propinas_semana
  for select using (public.es_miembro(local_id));
create policy "admin carga propinas" on public.propinas_semana
  for all using (public.es_admin(local_id)) with check (public.es_admin(local_id));
create policy "ver pagos" on public.pagos_propina
  for select using (public.es_miembro(local_id));
create policy "admin registra pagos" on public.pagos_propina
  for all using (public.es_admin(local_id)) with check (public.es_admin(local_id));

-- ---------- Funciones existentes ----------
create or replace function public.crear_local(p_nombre text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local uuid;
begin
  if auth.uid() is null then
    raise exception 'Hay que iniciar sesión';
  end if;

  insert into locales (nombre) values (p_nombre) returning id into v_local;
  insert into miembros (usuario_id, local_id, rol, email)
  values (auth.uid(), v_local, 'admin', (select email from auth.users where id = auth.uid()));

  insert into areas (local_id, nombre, orden) values
    (v_local, 'Salón', 1),
    (v_local, 'Cocina', 2);

  insert into tipos_turno (local_id, nombre, inicio, fin, color, orden, momento) values
    (v_local, 'Mañana', '09:00', '17:00', 'manana', 1, 'dia'),
    (v_local, 'Tarde',  '12:00', '20:00', 'tarde',  2, 'dia'),
    (v_local, 'Noche',  '17:00', '01:00', 'noche',  3, 'noche');

  return v_local;
end;
$$;

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

  -- Reabre solo las divisiones donde algo cambia de verdad
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
   where c.local_id = p_local and c.confirmado
     and c.fecha = x.fecha_jornada and c.area_id = e.area_id and c.momento = x.momento;

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
