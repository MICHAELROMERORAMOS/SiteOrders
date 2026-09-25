-- SiteOrders Owner / Administrator hierarchy
-- Applied to Supabase project MATERIAL REQUEST on 2026-09-25.
--
-- Model:
--   profiles.role = admin keeps compatibility with the existing app.
--   profiles.is_owner = true identifies the single protected application owner.
--
-- Rules:
--   * Owner cannot be modified through the application.
--   * Only Owner can promote/demote or activate/deactivate Administrators.
--   * Administrators can manage Worker / Supervisor / Store accounts.
--   * Direct client UPDATE/DELETE/TRUNCATE on profiles is disabled.
--   * User administration goes through the two RPCs below.

begin;

alter table public.profiles
  add column if not exists is_owner boolean not null default false;

do $$
declare
  v_admin_count integer;
begin
  select count(*) into v_admin_count
  from public.profiles
  where role='admin' and status='activo';

  if not exists (select 1 from public.profiles where is_owner) then
    if v_admin_count <> 1 then
      raise exception 'Owner bootstrap requires exactly one active administrator; found %.', v_admin_count;
    end if;

    update public.profiles
    set is_owner=true,
        updated_at=now()
    where id=(
      select id
      from public.profiles
      where role='admin' and status='activo'
      order by created_at
      limit 1
    );
  end if;
end
$$;

create unique index if not exists profiles_single_owner_idx
  on public.profiles ((1))
  where is_owner;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid='public.profiles'::regclass
      and conname='profiles_owner_requires_active_admin'
  ) then
    alter table public.profiles
      add constraint profiles_owner_requires_active_admin
      check (not is_owner or (role='admin' and status='activo'));
  end if;
end
$$;

create or replace function public.manage_user_role_v2(
  p_user_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_role text;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required.';
  end if;

  select * into v_actor
  from public.profiles
  where id=auth.uid();

  if not found or v_actor.role <> 'admin' or v_actor.status <> 'activo' then
    raise exception using errcode='42501', message='Administrator access required.';
  end if;

  select * into v_target
  from public.profiles
  where id=p_user_id;

  if not found then
    raise exception using errcode='P0002', message='User not found.';
  end if;

  if v_target.is_owner then
    raise exception using errcode='42501', message='The application owner is protected and cannot be modified.';
  end if;

  v_role:=lower(trim(coalesce(p_role,'')));
  if v_role='worker' then v_role:='encargado'; end if;

  if v_role not in ('encargado','supervisor','store','admin') then
    raise exception using errcode='22023', message='Invalid role.';
  end if;

  if not v_actor.is_owner then
    if v_target.role='admin' then
      raise exception using errcode='42501', message='Only the application owner can modify an Administrator.';
    end if;
    if v_role='admin' then
      raise exception using errcode='42501', message='Only the application owner can assign Administrator access.';
    end if;
  end if;

  update public.profiles
  set role=v_role,
      updated_at=now()
  where id=p_user_id;

  if v_role <> 'supervisor' then
    delete from public.project_members
    where user_id=p_user_id;
  end if;

  return jsonb_build_object(
    'id',p_user_id,
    'role',v_role,
    'status',v_target.status,
    'is_owner',false
  );
end;
$$;

create or replace function public.manage_user_status_v2(
  p_user_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_status text;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required.';
  end if;

  select * into v_actor
  from public.profiles
  where id=auth.uid();

  if not found or v_actor.role <> 'admin' or v_actor.status <> 'activo' then
    raise exception using errcode='42501', message='Administrator access required.';
  end if;

  select * into v_target
  from public.profiles
  where id=p_user_id;

  if not found then
    raise exception using errcode='P0002', message='User not found.';
  end if;

  if v_target.is_owner then
    raise exception using errcode='42501', message='The application owner is protected and cannot be modified.';
  end if;

  v_status:=lower(trim(coalesce(p_status,'')));
  if v_status not in ('activo','inactivo') then
    raise exception using errcode='22023', message='Invalid user status.';
  end if;

  if not v_actor.is_owner and v_target.role='admin' then
    raise exception using errcode='42501', message='Only the application owner can activate or deactivate an Administrator.';
  end if;

  update public.profiles
  set status=v_status,
      updated_at=now()
  where id=p_user_id;

  return jsonb_build_object(
    'id',p_user_id,
    'role',v_target.role,
    'status',v_status,
    'is_owner',false
  );
end;
$$;

revoke all on function public.manage_user_role_v2(uuid,text) from public;
revoke all on function public.manage_user_role_v2(uuid,text) from anon;
grant execute on function public.manage_user_role_v2(uuid,text) to authenticated;

revoke all on function public.manage_user_status_v2(uuid,text) from public;
revoke all on function public.manage_user_status_v2(uuid,text) from anon;
grant execute on function public.manage_user_status_v2(uuid,text) to authenticated;

drop policy if exists profiles_admin_update on public.profiles;

revoke update, delete, truncate on table public.profiles from anon, authenticated;
revoke update, delete, truncate on table public.profiles from public;

commit;
