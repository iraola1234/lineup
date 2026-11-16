-- =============================================================
-- 0009 · Días libres marcados con antelación
--
-- Cuando alguien pide un día, el admin lo marca en el calendario.
-- Para los cálculos vale igual que no tener turno (0 horas, sin
-- propina, no es ausencia): solo se guarda para que se vea.
-- =============================================================

create table if not exists public.dias_libres (
  local_id     uuid not null references public.locales (id) on delete cascade,
  empleado_id  uuid not null references public.empleados (id) on delete cascade,
  fecha        date not null,
  creado_en    timestamptz not null default now(),
  primary key (empleado_id, fecha)
);
create index if not exists dias_libres_local_fecha_idx on public.dias_libres (local_id, fecha);

alter table public.dias_libres enable row level security;
create policy "ver dias libres" on public.dias_libres
  for select using (public.es_miembro(local_id));
create policy "admin marca dias libres" on public.dias_libres
  for all using (public.es_admin(local_id)) with check (public.es_admin(local_id));
