-- Admin-only document sequence controls for Material Returns and Material Requests.
-- Applied to Supabase project evrntmqcyqmierjyqdvi on 2026-09-25.

create or replace function public.admin_get_document_sequences()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_returns jsonb;
  v_requests jsonb;
  v_request_padding integer;
begin
  if not public.is_active_admin() then
    raise exception using errcode='42501', message='Administrator access required.';
  end if;

  select coalesce(project_sequence_padding,2)
  into v_request_padding
  from public.app_settings
  where id=1;
  v_request_padding:=coalesce(v_request_padding,2);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'project_id', p.id,
      'project_code', p.codigo,
      'project_name', p.nombre,
      'last_issued', coalesce(issued.max_sequence,0),
      'next_number', coalesce(c.last_number + 1, greatest(coalesce(issued.max_sequence,0) + 1, 1))
    )
    order by p.codigo, p.nombre
  ), '[]'::jsonb)
  into v_returns
  from public.proyectos p
  left join material_request_private.material_return_counters c on c.project_id = p.id
  left join lateral (
    select max(r.project_sequence)::integer as max_sequence
    from public.material_returns r
    where r.project_id = p.id and r.project_sequence is not null
  ) issued on true;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'project_id', x.project_id,
      'project_code', x.project_code,
      'project_name', x.project_name,
      'user_id', x.user_id,
      'requester_name', x.requester_name,
      'requester_initials', x.requester_initials,
      'last_issued', x.last_issued,
      'next_number', x.next_number
    )
    order by x.project_code, x.project_name, x.requester_name
  ), '[]'::jsonb)
  into v_requests
  from (
    select
      p.id as project_id,
      p.codigo as project_code,
      p.nombre as project_name,
      pr.id as user_id,
      pr.full_name as requester_name,
      pr.document_initials as requester_initials,
      coalesce(issued.max_sequence,0) as last_issued,
      coalesce(c.next_number, greatest(coalesce(issued.max_sequence,0) + 1, 1)) as next_number
    from public.proyectos p
    cross join public.profiles pr
    left join public.project_requester_counters c
      on c.project_id = p.id and c.user_id = pr.id
    left join lateral (
      select max(o.project_sequence)::integer as max_sequence
      from public.pedidos o
      where o.project_id = p.id
        and o.user_id = pr.id
        and o.project_sequence is not null
    ) issued on true
    where pr.status='activo'
      and pr.role in ('admin','supervisor','encargado')
      and nullif(btrim(pr.document_initials),'') is not null
  ) x;

  return jsonb_build_object(
    'material_returns', v_returns,
    'material_requests', v_requests,
    'material_return_padding', 3,
    'material_request_padding', v_request_padding
  );
end;
$$;

create or replace function public.admin_set_material_return_next(
  p_project_id integer,
  p_next_number integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max_issued integer;
begin
  if not public.is_active_admin() then
    raise exception using errcode='42501', message='Administrator access required.';
  end if;
  if p_next_number is null or p_next_number < 1 then
    raise exception using errcode='22023', message='Next number must be 1 or greater.';
  end if;
  if not exists(select 1 from public.proyectos where id=p_project_id) then
    raise exception using errcode='P0002', message='Project not found.';
  end if;

  select coalesce(max(project_sequence),0)::integer
  into v_max_issued
  from public.material_returns
  where project_id=p_project_id and project_sequence is not null;

  if p_next_number <= v_max_issued then
    raise exception using errcode='22023',
      message=format('Next number must be greater than the last issued Material Return (%s).',v_max_issued);
  end if;

  insert into material_request_private.material_return_counters(project_id,last_number)
  values(p_project_id,p_next_number-1)
  on conflict(project_id) do update set last_number=excluded.last_number;

  return jsonb_build_object('project_id',p_project_id,'last_issued',v_max_issued,'next_number',p_next_number);
end;
$$;

create or replace function public.admin_set_material_request_next(
  p_project_id integer,
  p_user_id uuid,
  p_next_number integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max_issued integer;
begin
  if not public.is_active_admin() then
    raise exception using errcode='42501', message='Administrator access required.';
  end if;
  if p_next_number is null or p_next_number < 1 then
    raise exception using errcode='22023', message='Next number must be 1 or greater.';
  end if;
  if not exists(select 1 from public.proyectos where id=p_project_id) then
    raise exception using errcode='P0002', message='Project not found.';
  end if;
  if not exists(
    select 1
    from public.profiles
    where id=p_user_id
      and status='activo'
      and role in ('admin','supervisor','encargado')
      and nullif(btrim(document_initials),'') is not null
  ) then
    raise exception using errcode='22023', message='Requester must be active and have document initials.';
  end if;

  select coalesce(max(project_sequence),0)::integer
  into v_max_issued
  from public.pedidos
  where project_id=p_project_id
    and user_id=p_user_id
    and project_sequence is not null;

  if p_next_number <= v_max_issued then
    raise exception using errcode='22023',
      message=format('Next number must be greater than the last issued Material Request (%s).',v_max_issued);
  end if;

  insert into public.project_requester_counters(project_id,user_id,next_number)
  values(p_project_id,p_user_id,p_next_number)
  on conflict(project_id,user_id) do update set next_number=excluded.next_number;

  return jsonb_build_object(
    'project_id',p_project_id,
    'user_id',p_user_id,
    'last_issued',v_max_issued,
    'next_number',p_next_number
  );
end;
$$;

revoke all on function public.admin_get_document_sequences() from public, anon;
revoke all on function public.admin_set_material_return_next(integer,integer) from public, anon;
revoke all on function public.admin_set_material_request_next(integer,uuid,integer) from public, anon;

grant execute on function public.admin_get_document_sequences() to authenticated;
grant execute on function public.admin_set_material_return_next(integer,integer) to authenticated;
grant execute on function public.admin_set_material_request_next(integer,uuid,integer) to authenticated;
