-- =============================================================
-- Lineup · esquema inicial
-- Pegar completo en Supabase → SQL Editor → Run.
-- Ver especificación, sección 7 (modelo de datos).
-- =============================================================

-- ---------- Locales y miembros ----------

create table public.locales (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  creado_en  timestamptz not null default now()
);

create table public.miembros (
  usuario_id uuid not null references auth.users (id) on delete cascade,
  local_id   uuid not null references public.locales (id) on delete cascade,
  rol        text not null default 'encargado' check (rol in ('encargado')),
  creado_en  timestamptz not null default now(),
  primary key (usuario_id, local_id)
);

-- ¿El usuario actual pertenece a este local? (base de todas las reglas de acceso)
create or replace function public.es_miembro(p_local uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.miembros
    where local_id = p_local and usuario_id = auth.uid()
  );
$$;

-- ---------- Configuración ----------

create table public.areas (
  id        uuid primary key default gen_random_uuid(),
  local_id  uuid not null references public.locales (id) on delete cascade,
  nombre    text not null,
  orden     int  not null default 0
);

create table public.empleados (
  id                     uuid primary key default gen_random_uuid(),
  local_id               uuid not null references public.locales (id) on delete cascade,
  area_id                uuid not null references public.areas (id),
  nombre                 text not null,
  puesto                 text not null default '',
  horas_contrato_semana  numeric(4,1) not null default 48 check (horas_contrato_semana >= 0),
  participa_propina      boolean not null default true,
  valor_hora             numeric(10,2) check (valor_hora is null or valor_hora >= 0),
  activo                 boolean not null default true,
  orden                  int not null default 0,
  creado_en              timestamptz not null default now()
);

create table public.tipos_turno (
  id         uuid primary key default gen_random_uuid(),
  local_id   uuid not null references public.locales (id) on delete cascade,
  nombre     text not null,
  inicio     time not null,
  fin        time not null,
  color      text not null default 'manana',  -- clave de paleta: manana | tarde | noche | especial | ...
  orden      int  not null default 0,
  archivado  boolean not null default false,
  creado_en  timestamptz not null default now()
);

-- ---------- Operación ----------

-- Una fila por turno asignado. Guarda una COPIA del horario al momento de asignar,
-- así editar o archivar un tipo de turno no cambia el historial.
-- tipo_turno_id null = turno "Otro" (horario cargado a mano).
-- fecha_jornada = día en que EMPIEZA el turno (17–01 del viernes cuenta como viernes).
create table public.asignaciones (
  id             uuid primary key default gen_random_uuid(),
  local_id       uuid not null references public.locales (id) on delete cascade,
  empleado_id    uuid not null references public.empleados (id) on delete cascade,
  fecha_jornada  date not null,
  tipo_turno_id  uuid references public.tipos_turno (id) on delete set null,
  nombre_turno   text not null,
  color          text not null,
  inicio_plan    time not null,
  fin_plan       time not null,
  horas_plan     numeric(4,2) generated always as (
                   case
                     when fin_plan > inicio_plan
                       then extract(epoch from (fin_plan - inicio_plan)) / 3600
                     else 24 + extract(epoch from (fin_plan - inicio_plan)) / 3600
                   end
                 ) stored,
  horas_reales   numeric(4,2) check (horas_reales is null or (horas_reales >= 0 and horas_reales <= 24)),
  ausente        boolean not null default false,
  creado_en      timestamptz not null default now()
);

create index asignaciones_local_fecha on public.asignaciones (local_id, fecha_jornada);
create index asignaciones_empleado_fecha on public.asignaciones (empleado_id, fecha_jornada);

create table public.dias_cierre (
  local_id       uuid not null references public.locales (id) on delete cascade,
  fecha          date not null,
  confirmado     boolean not null default false,
  confirmado_en  timestamptz,
  primary key (local_id, fecha)
);

create table public.propinas_dia (
  local_id  uuid not null references public.locales (id) on delete cascade,
  fecha     date not null,
  monto     numeric(12,2) not null default 0 check (monto >= 0),
  primary key (local_id, fecha)
);

-- ---------- Seguridad (Row Level Security) ----------
-- Cada usuario solo ve y edita los datos de los locales donde es miembro.

alter table public.locales       enable row level security;
alter table public.miembros      enable row level security;
alter table public.areas         enable row level security;
alter table public.empleados     enable row level security;
alter table public.tipos_turno   enable row level security;
alter table public.asignaciones  enable row level security;
alter table public.dias_cierre   enable row level security;
alter table public.propinas_dia  enable row level security;

create policy "ver mis locales" on public.locales
  for select using (public.es_miembro(id));
create policy "editar mis locales" on public.locales
  for update using (public.es_miembro(id)) with check (public.es_miembro(id));

create policy "ver mis membresias" on public.miembros
  for select using (usuario_id = auth.uid());

create policy "areas del local" on public.areas
  for all using (public.es_miembro(local_id)) with check (public.es_miembro(local_id));
create policy "empleados del local" on public.empleados
  for all using (public.es_miembro(local_id)) with check (public.es_miembro(local_id));
create policy "tipos de turno del local" on public.tipos_turno
  for all using (public.es_miembro(local_id)) with check (public.es_miembro(local_id));
create policy "asignaciones del local" on public.asignaciones
  for all using (public.es_miembro(local_id)) with check (public.es_miembro(local_id));
create policy "cierres del local" on public.dias_cierre
  for all using (public.es_miembro(local_id)) with check (public.es_miembro(local_id));
create policy "propinas del local" on public.propinas_dia
  for all using (public.es_miembro(local_id)) with check (public.es_miembro(local_id));

-- ---------- Alta de un local ----------
-- La app la llama la primera vez que entra un encargado sin local.
-- Crea el local, lo asocia al usuario y carga áreas y turnos iniciales.

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
  insert into miembros (usuario_id, local_id) values (auth.uid(), v_local);

  insert into areas (local_id, nombre, orden) values
    (v_local, 'Salón', 1),
    (v_local, 'Cocina', 2);

  insert into tipos_turno (local_id, nombre, inicio, fin, color, orden) values
    (v_local, 'Mañana', '09:00', '17:00', 'manana', 1),
    (v_local, 'Tarde',  '12:00', '20:00', 'tarde',  2),
    (v_local, 'Noche',  '17:00', '01:00', 'noche',  3);

  return v_local;
end;
$$;

revoke all on function public.crear_local(text) from public, anon;
grant execute on function public.crear_local(text) to authenticated;
revoke all on function public.es_miembro(uuid) from public, anon;
grant execute on function public.es_miembro(uuid) to authenticated;
