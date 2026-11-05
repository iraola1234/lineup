-- =============================================================
-- Lineup · 0002 · proteger el historial
-- Pegar en Supabase → SQL Editor → Run (después de 0001).
--
-- Un empleado con turnos en el historial ya no se puede borrar
-- (la app lo da de baja en su lugar), así no se pierden sus horas
-- ni sus propinas.
-- =============================================================

alter table public.asignaciones
  drop constraint asignaciones_empleado_id_fkey,
  add constraint asignaciones_empleado_id_fkey
    foreign key (empleado_id) references public.empleados (id) on delete restrict;
