-- =============================================================
-- 0006 · Vincular un usuario (admin o encargado) con su ficha de empleado
--
-- Ej.: el admin también trabaja en el salón; así figura en horarios,
-- horas y propinas como cualquier empleado y la app sabe que es él.
-- Un empleado puede estar vinculado a un solo usuario por local.
-- =============================================================

alter table public.empleados
  add constraint empleados_id_local_key unique (id, local_id);

alter table public.miembros
  add column if not exists empleado_id uuid;
alter table public.miembros
  add constraint miembros_empleado_fkey foreign key (empleado_id, local_id)
  references public.empleados (id, local_id) on delete set null (empleado_id);
create unique index if not exists miembros_empleado_unico
  on public.miembros (local_id, empleado_id) where empleado_id is not null;

alter table public.invitaciones
  add column if not exists empleado_id uuid;
alter table public.invitaciones
  add constraint invitaciones_empleado_fkey foreign key (empleado_id, local_id)
  references public.empleados (id, local_id) on delete set null (empleado_id);

-- Al aceptar la invitación, el vínculo pasa al usuario
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
    -- si esa ficha ya está vinculada a otro usuario, no se pisa
    insert into miembros (usuario_id, local_id, rol, email, nombre, empleado_id)
    values (
      auth.uid(), v_inv.local_id, v_inv.rol, v_email, v_inv.nombre,
      case when exists (select 1 from miembros m where m.local_id = v_inv.local_id and m.empleado_id = v_inv.empleado_id)
           then null else v_inv.empleado_id end
    )
    on conflict (usuario_id, local_id) do update
      set rol = excluded.rol, nombre = excluded.nombre, email = excluded.email,
          empleado_id = coalesce(excluded.empleado_id, miembros.empleado_id);

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
