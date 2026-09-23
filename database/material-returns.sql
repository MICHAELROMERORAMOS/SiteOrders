-- SiteOrders: persistent material return drafts and private PDF branding.
-- Apply to the MATERIAL REQUEST Supabase project.

create table if not exists public.material_returns (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id),
  project_id integer references public.proyectos(id) on delete set null,
  project_code text,
  project_name text,
  return_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_return_items (
  id bigint generated always as identity primary key,
  return_id uuid not null references public.material_returns(id) on delete cascade,
  material_id integer references public.materiales(id) on delete set null,
  sku_snapshot text not null,
  description_snapshot text not null,
  unit_snapshot text not null,
  quantity numeric(12,3) not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (return_id, material_id)
);

create index if not exists material_returns_created_by_idx on public.material_returns(created_by, updated_at desc);
create index if not exists material_returns_project_idx on public.material_returns(project_id);
create index if not exists material_return_items_return_idx on public.material_return_items(return_id);

create or replace function public.snapshot_material_return_project()
returns trigger language plpgsql set search_path = '' as $$
declare project record;
begin
  if tg_op = 'UPDATE' then new.created_by := old.created_by; end if;
  if new.project_id is null then
    if tg_op = 'UPDATE' and old.project_id is not null then
      -- Keep the historical project label if a site is later deleted.
      new.project_code := old.project_code;
      new.project_name := old.project_name;
    end if;
    return new;
  end if;
  select p.codigo, p.nombre into project from public.proyectos p where p.id = new.project_id;
  if not found then raise exception 'Project not available'; end if;
  new.project_code := project.codigo;
  new.project_name := project.nombre;
  return new;
end;
$$;
create trigger snapshot_material_return_project
before insert or update on public.material_returns
for each row execute function public.snapshot_material_return_project();

-- Capture supplier data when the line is added; a later catalogue edit cannot
-- silently change an existing return or its PDF.
create or replace function public.snapshot_material_return_item()
returns trigger language plpgsql set search_path = '' as $$
declare material record;
begin
  if new.material_id is null then
    if tg_op = 'UPDATE' then
      new.sku_snapshot := old.sku_snapshot;
      new.description_snapshot := old.description_snapshot;
      new.unit_snapshot := old.unit_snapshot;
    end if;
    return new;
  end if;
  select m.id_material, coalesce(nullif(m.descripcion, ''), m.nombre) as description,
         m.unidad_medida into material
    from public.materiales m where m.id = new.material_id;
  if not found then raise exception 'Material not available'; end if;
  new.sku_snapshot := material.id_material;
  new.description_snapshot := material.description;
  new.unit_snapshot := material.unidad_medida;
  return new;
end;
$$;

create trigger snapshot_material_return_item
before insert or update on public.material_return_items
for each row execute function public.snapshot_material_return_item();

create table if not exists public.material_return_branding (
  id smallint primary key default 1 check (id = 1),
  company_name text not null check (length(btrim(company_name)) between 1 and 120),
  logo_path text check (logo_path is null or logo_path = 'company-logo.png'),
  updated_at timestamptz not null default now()
);

insert into public.material_return_branding(id, company_name)
select 1, coalesce((select nullif(company_name, '') from public.app_settings limit 1), 'Smart Effects Limited')
on conflict (id) do nothing;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('material-return-branding', 'material-return-branding', false, 2097152, array['image/png'])
on conflict (id) do nothing;

alter table public.material_returns enable row level security;
alter table public.material_return_items enable row level security;
alter table public.material_return_branding enable row level security;

-- Existing roles are admin, supervisor, store and encargado (worker).
-- Store cannot access returns. Workers see and edit their own returns.
create policy material_returns_select on public.material_returns
for select to authenticated using (
  public.is_active_admin() or public.is_active_supervisor() or
  (public.is_active_worker() and created_by = (select auth.uid()))
);
create policy material_returns_insert on public.material_returns
for insert to authenticated with check (
  created_by = (select auth.uid()) and
  (public.is_active_admin() or public.is_active_supervisor() or public.is_active_worker())
);
create policy material_returns_update on public.material_returns
for update to authenticated using (
  public.is_active_admin() or public.is_active_supervisor() or
  (public.is_active_worker() and created_by = (select auth.uid()))
) with check (
  public.is_active_admin() or public.is_active_supervisor() or
  (public.is_active_worker() and created_by = (select auth.uid()))
);
create policy material_returns_delete on public.material_returns
for delete to authenticated using (
  public.is_active_admin() or public.is_active_supervisor() or
  (public.is_active_worker() and created_by = (select auth.uid()))
);

-- Parent SELECT policy is also evaluated inside these EXISTS checks.
create policy material_return_items_select on public.material_return_items
for select to authenticated using (
  exists (select 1 from public.material_returns r where r.id = return_id)
);
create policy material_return_items_insert on public.material_return_items
for insert to authenticated with check (
  exists (select 1 from public.material_returns r where r.id = return_id)
);
create policy material_return_items_update on public.material_return_items
for update to authenticated using (
  exists (select 1 from public.material_returns r where r.id = return_id)
) with check (
  exists (select 1 from public.material_returns r where r.id = return_id)
);
create policy material_return_items_delete on public.material_return_items
for delete to authenticated using (
  exists (select 1 from public.material_returns r where r.id = return_id)
);

-- A complete draft is saved atomically. If an item is invalid, neither the
-- header nor its previous lines are changed. RLS still applies to every row.
create or replace function public.save_material_return(
  p_return_id uuid, p_project_id integer, p_return_date date, p_items jsonb
) returns public.material_returns
language plpgsql security invoker set search_path = '' as $$
declare saved public.material_returns;
begin
  if p_return_date is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 300 then
    raise exception 'Invalid material return draft';
  end if;
  update public.material_returns
     set project_id = p_project_id, return_date = p_return_date, updated_at = now()
   where id = p_return_id returning * into saved;
  if not found then raise exception 'Material return is unavailable'; end if;
  delete from public.material_return_items where return_id = p_return_id;
  insert into public.material_return_items(return_id, material_id, sku_snapshot, description_snapshot, unit_snapshot, quantity)
  select p_return_id, item.material_id,
         coalesce(item.sku_snapshot, ''), coalesce(item.description_snapshot, ''),
         coalesce(item.unit_snapshot, ''), item.quantity
  from jsonb_to_recordset(p_items) as item(
    material_id integer, sku_snapshot text, description_snapshot text,
    unit_snapshot text, quantity numeric
  );
  return saved;
end;
$$;
revoke all on function public.save_material_return(uuid, integer, date, jsonb) from public;
grant execute on function public.save_material_return(uuid, integer, date, jsonb) to authenticated;

create policy material_return_branding_select on public.material_return_branding
for select to authenticated using (public.is_active_admin() or public.is_active_supervisor());
create policy material_return_branding_update on public.material_return_branding
for update to authenticated using (public.is_active_admin())
with check (public.is_active_admin());

-- Fixed object path: only admins can replace the logo, and it is private.
create policy material_return_logo_read on storage.objects
for select to authenticated using (
  bucket_id = 'material-return-branding' and name = 'company-logo.png' and
  (public.is_active_admin() or public.is_active_supervisor())
);
create policy material_return_logo_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'material-return-branding' and name = 'company-logo.png' and public.is_active_admin()
);
create policy material_return_logo_update on storage.objects
for update to authenticated using (
  bucket_id = 'material-return-branding' and name = 'company-logo.png' and public.is_active_admin()
) with check (
  bucket_id = 'material-return-branding' and name = 'company-logo.png' and public.is_active_admin()
);

grant select, insert, update, delete on public.material_returns to authenticated;
grant select, insert, update, delete on public.material_return_items to authenticated;
grant usage, select on sequence public.material_return_items_id_seq to authenticated;
grant select, update on public.material_return_branding to authenticated;
grant select, insert, update, delete on public.material_returns, public.material_return_items to service_role;
grant select, update on public.material_return_branding to service_role;
