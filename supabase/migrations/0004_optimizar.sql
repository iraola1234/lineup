-- =============================================================
-- Lineup · 0004 · optimización (recomendaciones de Supabase)
-- No modifica datos: agrega índices y reescribe una regla de acceso.
-- =============================================================

-- Índices para las claves foráneas que se consultan seguido.
create index if not exists areas_local_idx           on public.areas (local_id);
create index if not exists empleados_local_idx       on public.empleados (local_id);
create index if not exists empleados_area_idx        on public.empleados (area_id);
create index if not exists tipos_turno_local_idx     on public.tipos_turno (local_id);
create index if not exists miembros_local_idx        on public.miembros (local_id);
create index if not exists asignaciones_tipo_idx     on public.asignaciones (tipo_turno_id);

-- auth.uid() se evalúa una vez por consulta en lugar de una vez por fila.
drop policy if exists "ver mis membresias" on public.miembros;
create policy "ver mis membresias" on public.miembros
  for select using (usuario_id = (select auth.uid()));

create or replace function public.es_miembro(p_local uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.miembros
    where local_id = p_local and usuario_id = (select auth.uid())
  );
$$;
