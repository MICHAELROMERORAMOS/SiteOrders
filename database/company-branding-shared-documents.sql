-- Share the existing company branding with all active roles that may generate
-- Material Request PDFs. Editing remains administrator-only.

drop policy if exists material_return_branding_select on public.material_return_branding;
create policy material_return_branding_select
on public.material_return_branding
for select
to authenticated
using (
  public.is_active_admin()
  or public.is_active_supervisor()
  or public.is_active_worker()
  or public.is_active_store()
);

drop policy if exists material_return_logo_read on storage.objects;
create policy material_return_logo_read
on storage.objects
for select
to authenticated
using (
  bucket_id='material-return-branding'
  and name='company-logo.png'
  and (
    public.is_active_admin()
    or public.is_active_supervisor()
    or public.is_active_worker()
    or public.is_active_store()
  )
);
