-- Follow-up for instances where the counter table was first created in public.
do $$
begin
  if to_regclass('public.material_return_counters') is not null then
    alter table public.material_return_counters set schema material_request_private;
  end if;
end;
$$;

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
