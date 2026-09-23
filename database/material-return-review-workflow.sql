-- Run after material-returns-project-sequence.sql and counter-hardening.sql.
-- Existing returns and their lines are preserved as drafts; all project
-- counters restart at 001 on the first submission for review.

alter table public.material_returns
  add column if not exists status text not null default 'draft'
    check (status in ('draft', 'submitted')),
  add column if not exists submitted_at timestamptz,
  add column if not exists submitted_by uuid references public.profiles(id) on delete set null,
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by uuid references public.profiles(id) on delete set null;

drop trigger if exists assign_material_return_sequence on public.material_returns;
update public.material_returns
set status = 'draft', project_sequence = null,
    submitted_at = null, submitted_by = null,
    reopened_at = null, reopened_by = null;
delete from material_request_private.material_return_counters;

-- The trigger runs with access to the private counter. Selecting a project
-- never allocates a number; the draft -> submitted transition does.
create or replace function material_request_private.assign_material_return_sequence()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null and
     coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Authentication required';
  end if;

  if tg_op = 'INSERT' then
    new.project_sequence := null;
    return new;
  end if;

  if old.project_sequence is not null then
    if new.project_id is not null and new.project_id is distinct from old.project_id then
      raise exception 'Create a new return to use another project';
    end if;
    new.project_sequence := old.project_sequence;
    return new;
  end if;

  new.project_sequence := null;
  if old.status = 'draft' and new.status = 'submitted' then
    if new.project_id is null then raise exception 'Select a project before submitting'; end if;
    insert into material_request_private.material_return_counters(project_id, last_number)
    values (new.project_id, 1)
    on conflict (project_id) do update
      set last_number = material_request_private.material_return_counters.last_number + 1
    returning last_number into new.project_sequence;
  end if;
  return new;
end;
$$;
revoke all on function material_request_private.assign_material_return_sequence() from public;
create trigger assign_material_return_sequence
before insert or update on public.material_returns
for each row execute function material_request_private.assign_material_return_sequence();

create or replace function material_request_private.guard_material_return()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then raise exception 'A return must start as a draft'; end if;
    new.submitted_at := null;
    new.submitted_by := null;
    new.reopened_at := null;
    new.reopened_by := null;
    return new;
  end if;

  if old.status = 'submitted' then
    if new.status <> 'draft' or not public.is_active_admin() then
      raise exception 'This return is submitted. Only an administrator can reopen it';
    end if;
    if (to_jsonb(new) - 'status' - 'updated_at' - 'reopened_at' - 'reopened_by')
       is distinct from
       (to_jsonb(old) - 'status' - 'updated_at' - 'reopened_at' - 'reopened_by') then
      raise exception 'Reopen the return before changing any details';
    end if;
    new.reopened_at := now();
    new.reopened_by := auth.uid();
    return new;
  end if;

  if new.status = 'submitted' then
    if new.project_id is null or new.project_sequence is null then
      raise exception 'Choose a project before submitting';
    end if;
    if not exists (
      select 1 from public.material_return_items i
      where i.return_id = old.id and i.quantity > 0
    ) then
      raise exception 'Add at least one material before submitting';
    end if;
    new.submitted_at := now();
    new.submitted_by := auth.uid();
    new.reopened_at := old.reopened_at;
    new.reopened_by := old.reopened_by;
    return new;
  end if;

  if new.status <> 'draft' then raise exception 'Invalid return status'; end if;
  new.submitted_at := old.submitted_at;
  new.submitted_by := old.submitted_by;
  new.reopened_at := old.reopened_at;
  new.reopened_by := old.reopened_by;
  return new;
end;
$$;
revoke all on function material_request_private.guard_material_return() from public;

drop trigger if exists zz_guard_material_return on public.material_returns;
create trigger zz_guard_material_return
before insert or update on public.material_returns
for each row execute function material_request_private.guard_material_return();

-- The return itself is never deleted through the application.
drop policy if exists material_returns_delete on public.material_returns;
revoke delete on public.material_returns from authenticated;

-- Details may change only while the parent return is a draft. Parent SELECT
-- still enforces ownership and role based visibility.
drop policy if exists material_return_items_insert on public.material_return_items;
create policy material_return_items_insert on public.material_return_items
for insert to authenticated with check (
  exists (select 1 from public.material_returns r where r.id = return_id and r.status = 'draft')
);
drop policy if exists material_return_items_update on public.material_return_items;
create policy material_return_items_update on public.material_return_items
for update to authenticated using (
  exists (select 1 from public.material_returns r where r.id = return_id and r.status = 'draft')
) with check (
  exists (select 1 from public.material_returns r where r.id = return_id and r.status = 'draft')
);
drop policy if exists material_return_items_delete on public.material_return_items;
create policy material_return_items_delete on public.material_return_items
for delete to authenticated using (
  exists (select 1 from public.material_returns r where r.id = return_id and r.status = 'draft')
);

create or replace function public.submit_material_return(p_return_id uuid)
returns public.material_returns language plpgsql security invoker set search_path = '' as $$
declare saved public.material_returns;
begin
  update public.material_returns
  set status = 'submitted', updated_at = now()
  where id = p_return_id and status = 'draft'
  returning * into saved;
  if not found then raise exception 'This return cannot be submitted'; end if;
  return saved;
end;
$$;
revoke all on function public.submit_material_return(uuid) from public;
grant execute on function public.submit_material_return(uuid) to authenticated;

create or replace function public.reopen_material_return(p_return_id uuid)
returns public.material_returns language plpgsql security invoker set search_path = '' as $$
declare saved public.material_returns;
begin
  if not public.is_active_admin() then raise exception 'Only an administrator can reopen a return'; end if;
  update public.material_returns
  set status = 'draft', updated_at = now()
  where id = p_return_id and status = 'submitted'
  returning * into saved;
  if not found then raise exception 'This return cannot be reopened'; end if;
  return saved;
end;
$$;
revoke all on function public.reopen_material_return(uuid) from public;
grant execute on function public.reopen_material_return(uuid) to authenticated;
