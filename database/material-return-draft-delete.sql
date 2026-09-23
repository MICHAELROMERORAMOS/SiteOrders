-- Allow deletion only for Material Return drafts that have never been submitted.
-- A reopened return keeps project_sequence and therefore remains protected.

drop policy if exists material_returns_delete_draft on public.material_returns;

create policy material_returns_delete_draft
on public.material_returns
for delete
to authenticated
using (
  status = 'draft'
  and project_sequence is null
  and (
    public.is_active_admin()
    or public.is_active_supervisor()
    or (
      public.is_active_worker()
      and created_by = (select auth.uid())
    )
  )
);

grant delete on table public.material_returns to authenticated;
