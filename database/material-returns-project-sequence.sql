-- Follow-up to material-returns.sql. Apply once to MATERIAL REQUEST.
-- Numbers start when a return is first assigned to a project; each project
-- advances its own counter atomically. A deleted return never reuses a number.

alter table public.material_returns
  add column if not exists project_sequence integer;

create schema if not exists material_request_private;
revoke all on schema material_request_private from anon, authenticated;

create table if not exists material_request_private.material_return_counters (
  project_id integer primary key references public.proyectos(id) on delete cascade,
  last_number integer not null check (last_number >= 0)
);
alter table material_request_private.material_return_counters enable row level security;
revoke all on material_request_private.material_return_counters from anon, authenticated;

-- Backfill any returns that predate the sequence without renumbering them again.
with numbered as (
  select id, row_number() over (partition by project_id order by created_at, id)::integer as n
  from public.material_returns where project_id is not null and project_sequence is null
)
update public.material_returns r set project_sequence = numbered.n
from numbered where r.id = numbered.id;

insert into material_request_private.material_return_counters(project_id, last_number)
select project_id, max(project_sequence)
from public.material_returns where project_id is not null
group by project_id
on conflict (project_id) do update
set last_number = greatest(material_request_private.material_return_counters.last_number, excluded.last_number);

create unique index if not exists material_returns_project_sequence_key
  on public.material_returns(project_id, project_sequence)
  where project_id is not null;

create or replace function material_request_private.assign_material_return_sequence()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null and
     coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Authentication required';
  end if;
  if tg_op = 'UPDATE' and old.project_sequence is not null then
    if new.project_id is not null and new.project_id is distinct from old.project_id then
      raise exception 'Create a new return to use another project';
    end if;
    new.project_sequence := old.project_sequence;
    return new;
  end if;

  if new.project_id is null then
    new.project_sequence := null;
    return new;
  end if;

  insert into material_request_private.material_return_counters(project_id, last_number)
  values (new.project_id, 1)
  on conflict (project_id) do update
    set last_number = material_request_private.material_return_counters.last_number + 1
  returning last_number into new.project_sequence;
  return new;
end;
$$;
revoke all on function material_request_private.assign_material_return_sequence() from public;

drop trigger if exists assign_material_return_sequence on public.material_returns;
create trigger assign_material_return_sequence
before insert or update on public.material_returns
for each row execute function material_request_private.assign_material_return_sequence();

-- All return creators may download the branded PDF; only an admin edits branding.
drop policy if exists material_return_branding_select on public.material_return_branding;
create policy material_return_branding_select on public.material_return_branding
for select to authenticated using (
  public.is_active_admin() or public.is_active_supervisor() or public.is_active_worker()
);

drop policy if exists material_return_logo_read on storage.objects;
create policy material_return_logo_read on storage.objects
for select to authenticated using (
  bucket_id = 'material-return-branding' and name = 'company-logo.png' and
  (public.is_active_admin() or public.is_active_supervisor() or public.is_active_worker())
);

-- Once a material request has been created, workers cannot delete it.
-- Supervisors are restricted to projects they manage.
drop policy if exists pedidos_delete_admin_supervisor on public.pedidos;
create policy pedidos_delete_admin_supervisor on public.pedidos
for delete to authenticated using (
  public.is_active_admin() or
  (public.is_active_supervisor() and public.supervisor_has_project(project_id))
);

-- Keep the existing category IDs and all foreign keys to materials intact.
update public.categorias set nombre = case nombre
  when 'Materiales' then 'Materials'
  when 'Equipos' then 'Equipment'
  when 'Herramientas' then 'Tools'
  when 'Protección personal' then 'Personal Protective Equipment'
  else nombre end
where nombre in ('Materiales', 'Equipos', 'Herramientas', 'Protección personal');
