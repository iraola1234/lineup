-- =============================================================
-- 0008 · La propina se carga por día y se paga por semana
--
-- Cada día se reparte entre quienes trabajaron ese día (por hora);
-- a cada persona se le paga la suma de la semana. Se vuelve a usar
-- propinas_dia: todos la ven, solo el admin carga montos.
-- (propinas_semana queda sin uso.)
-- =============================================================

alter table public.propinas_dia
  add column if not exists actualizado_en timestamptz not null default now();

drop policy if exists "propinas del local" on public.propinas_dia;
create policy "ver propinas del dia" on public.propinas_dia
  for select using (public.es_miembro(local_id));
create policy "admin carga propinas del dia" on public.propinas_dia
  for all using (public.es_admin(local_id)) with check (public.es_admin(local_id));
