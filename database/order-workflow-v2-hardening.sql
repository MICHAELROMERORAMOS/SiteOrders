-- SiteOrders Workflow V2 - hardening applied after the main migration.
-- Safe to run after database/order-workflow-v2.sql.

begin;

-- SECURITY DEFINER functions are not callable anonymously.
revoke execute on function public.approve_material_request_v2(integer) from public, anon;
revoke execute on function public.can_view_order_v2(integer) from public, anon;
revoke execute on function public.confirm_dispatch_receipt_v2(bigint,jsonb) from public, anon;
revoke execute on function public.create_material_request(integer,text,text,date,text,text,jsonb) from public, anon;
revoke execute on function public.create_material_request_v2(integer,text,text,date,text,text,jsonb,uuid) from public, anon;
revoke execute on function public.decide_alternative_v2(bigint,text,text) from public, anon;
revoke execute on function public.dispatch_material_request_v2(integer,text,jsonb) from public, anon;
revoke execute on function public.get_my_role() from public, anon;
revoke execute on function public.get_my_status() from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_active_admin() from public, anon;
revoke execute on function public.is_active_store() from public, anon;
revoke execute on function public.is_active_supervisor() from public, anon;
revoke execute on function public.is_active_user() from public, anon;
revoke execute on function public.is_active_worker() from public, anon;
revoke execute on function public.list_request_receivers_v2(integer) from public, anon;
revoke execute on function public.propose_alternative_v2(integer,integer,integer,text) from public, anon;
revoke execute on function public.reject_material_request_v2(integer,text) from public, anon;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.supervisor_has_project(integer) from public, anon;
revoke execute on function public.update_material_request_v2(integer,integer,uuid,text,text,date,jsonb) from public, anon;

-- Explicit application RPC grants.
grant execute on function public.approve_material_request_v2(integer) to authenticated;
grant execute on function public.can_view_order_v2(integer) to authenticated;
grant execute on function public.confirm_dispatch_receipt_v2(bigint,jsonb) to authenticated;
grant execute on function public.create_material_request(integer,text,text,date,text,text,jsonb) to authenticated;
grant execute on function public.create_material_request_v2(integer,text,text,date,text,text,jsonb,uuid) to authenticated;
grant execute on function public.decide_alternative_v2(bigint,text,text) to authenticated;
grant execute on function public.dispatch_material_request_v2(integer,text,jsonb) to authenticated;
grant execute on function public.get_my_role() to authenticated;
grant execute on function public.get_my_status() to authenticated;
grant execute on function public.is_active_admin() to authenticated;
grant execute on function public.is_active_store() to authenticated;
grant execute on function public.is_active_supervisor() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_active_worker() to authenticated;
grant execute on function public.list_request_receivers_v2(integer) to authenticated;
grant execute on function public.propose_alternative_v2(integer,integer,integer,text) to authenticated;
grant execute on function public.reject_material_request_v2(integer,text) to authenticated;
grant execute on function public.supervisor_has_project(integer) to authenticated;
grant execute on function public.update_material_request_v2(integer,integer,uuid,text,text,date,jsonb) to authenticated;

-- Foreign-key indexes used by the new workflow.
create index if not exists idx_order_activity_actor_id on public.order_activity(actor_id);
create index if not exists idx_order_alternatives_material_id on public.order_alternatives(alternative_material_id);
create index if not exists idx_order_alternatives_decided_by on public.order_alternatives(decided_by);
create index if not exists idx_order_alternatives_proposed_by on public.order_alternatives(proposed_by);
create index if not exists idx_order_dispatch_items_material_id on public.order_dispatch_items(material_id);
create index if not exists idx_order_dispatch_items_received_by on public.order_dispatch_items(received_by);
create index if not exists idx_order_dispatches_dispatched_by on public.order_dispatches(dispatched_by);
create index if not exists idx_order_dispatches_receipt_confirmed_by on public.order_dispatches(receipt_confirmed_by);
create index if not exists idx_pedido_items_received_by on public.pedido_items(received_by);
create index if not exists idx_pedidos_created_by on public.pedidos(created_by);
create index if not exists idx_pedidos_requested_for on public.pedidos(requested_for);
create index if not exists idx_pedidos_receipt_confirmed_by on public.pedidos(receipt_confirmed_by);

-- Avoid duplicate permissive INSERT policies on inventory.
drop policy if exists materiales_insert_admin on public.materiales;
drop policy if exists materiales_insert_store on public.materiales;
drop policy if exists materiales_insert_admin_or_store on public.materiales;
create policy materiales_insert_admin_or_store on public.materiales for insert to authenticated
with check(public.is_active_admin() or public.is_active_store());

-- app_settings can never be deleted through the application.
drop policy if exists app_settings_delete_admin on public.app_settings;

-- Cache auth.uid() once per statement in high-use RLS policies.
drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles for select to authenticated
using(((select auth.uid())=id) or public.is_active_admin());

drop policy if exists profiles_insert_own_pending on public.profiles;
create policy profiles_insert_own_pending on public.profiles for insert to authenticated
with check(((select auth.uid())=id) and role='encargado' and status='pendiente');

drop policy if exists pedidos_insert_own_pending on public.pedidos;
create policy pedidos_insert_own_pending on public.pedidos for insert to authenticated
with check(public.is_active_user() and user_id=(select auth.uid()) and status='pending');

drop policy if exists pedido_items_insert_own_pending_order on public.pedido_items;
create policy pedido_items_insert_own_pending_order on public.pedido_items for insert to authenticated
with check(public.is_active_user() and exists(
  select 1 from public.pedidos p
  where p.id=pedido_items.pedido_id and p.user_id=(select auth.uid()) and p.status='pending'
));

drop policy if exists requester_counters_select_self_or_admin on public.requester_order_counters;
create policy requester_counters_select_self_or_admin on public.requester_order_counters for select to authenticated
using(public.is_active_user() and (user_id=(select auth.uid()) or public.is_active_admin()));

drop policy if exists project_requester_counters_select_self_or_admin on public.project_requester_counters;
create policy project_requester_counters_select_self_or_admin on public.project_requester_counters for select to authenticated
using(public.is_active_user() and (user_id=(select auth.uid()) or public.is_active_admin()));

drop policy if exists project_members_select on public.project_members;
create policy project_members_select on public.project_members for select to authenticated
using(user_id=(select auth.uid()) or public.is_active_admin());

drop policy if exists pedidos_select_workflow_v2 on public.pedidos;
create policy pedidos_select_workflow_v2 on public.pedidos for select to authenticated using(
  public.is_active_admin()
  or (public.is_active_worker() and user_id=(select auth.uid()))
  or (public.is_active_supervisor() and public.supervisor_has_project(project_id))
  or (public.is_active_store() and status in ('approved','awaiting_receipt','partial','completed','delivered'))
);

commit;
