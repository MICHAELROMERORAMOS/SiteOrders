-- Prevent Store accounts from creating orders through legacy RPC/direct INSERT paths.
-- This keeps the current production frontend compatible while enforcing the V2 role rule.

begin;

create or replace function public.block_store_order_insert_v2()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if public.is_active_store() then
    raise exception using errcode='42501', message='Store users cannot create material requests.';
  end if;
  return new;
end;
$$;

revoke execute on function public.block_store_order_insert_v2() from public, anon, authenticated;

drop trigger if exists trg_block_store_order_insert_v2 on public.pedidos;
create trigger trg_block_store_order_insert_v2
before insert on public.pedidos
for each row execute function public.block_store_order_insert_v2();

drop policy if exists pedidos_insert_own_pending on public.pedidos;
create policy pedidos_insert_own_pending on public.pedidos for insert to authenticated
with check(public.is_active_user() and not public.is_active_store() and user_id=(select auth.uid()) and status='pending');

drop policy if exists pedido_items_insert_own_pending_order on public.pedido_items;
create policy pedido_items_insert_own_pending_order on public.pedido_items for insert to authenticated
with check(public.is_active_user() and not public.is_active_store() and exists(
  select 1 from public.pedidos p
  where p.id=pedido_items.pedido_id and p.user_id=(select auth.uid()) and p.status='pending'
));

commit;
