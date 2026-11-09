-- Latest source workbook per church/year. Original bytes are base64 encoded so the
-- metadata and replacement can be committed atomically through PostgREST.
begin;
create table if not exists public.reconciliation_workbooks (
  church_id uuid not null references public.churches(id),
  financial_year_id uuid not null references public.financial_years(id),
  file_name text not null check (length(file_name) between 1 and 255 and file_name ~* '\.(xlsx|xls)$'),
  file_size integer not null check (file_size between 1 and 10485760),
  file_base64 text not null check (length(file_base64) <= 13981016 and octet_length(decode(file_base64, 'base64')) = file_size),
  uploaded_by uuid not null,
  uploaded_at timestamptz not null default now(),
  primary key (church_id, financial_year_id)
);

-- Retain the uploader UUID even if an administrator later removes their profile.
alter table public.reconciliation_workbooks drop constraint if exists reconciliation_workbooks_uploaded_by_fkey;

create or replace function public.stamp_reconciliation_workbook() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.uploaded_by := auth.uid();
  new.uploaded_at := statement_timestamp();
  return new;
end;
$$;
drop trigger if exists stamp_reconciliation_workbook on public.reconciliation_workbooks;
create trigger stamp_reconciliation_workbook before insert or update on public.reconciliation_workbooks
for each row execute function public.stamp_reconciliation_workbook();

alter table public.reconciliation_workbooks enable row level security;
revoke all on public.reconciliation_workbooks from anon, authenticated;
grant select, insert, update on public.reconciliation_workbooks to authenticated;

drop policy if exists "Active church personnel can read source ledgers" on public.reconciliation_workbooks;
create policy "Active church personnel can read source ledgers" on public.reconciliation_workbooks
for select to authenticated using (
  church_id = public.get_auth_church_id()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active)
);
drop policy if exists "Active church personnel can save source ledgers" on public.reconciliation_workbooks;
create policy "Active church personnel can save source ledgers" on public.reconciliation_workbooks
for insert to authenticated with check (
  church_id = public.get_auth_church_id() and uploaded_by = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active)
  and exists (select 1 from public.financial_years y where y.id = reconciliation_workbooks.financial_year_id and y.church_id = reconciliation_workbooks.church_id)
);
drop policy if exists "Active church personnel can replace source ledgers" on public.reconciliation_workbooks;
create policy "Active church personnel can replace source ledgers" on public.reconciliation_workbooks
for update to authenticated using (
  church_id = public.get_auth_church_id()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active)
) with check (
  church_id = public.get_auth_church_id() and uploaded_by = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active)
  and exists (select 1 from public.financial_years y where y.id = reconciliation_workbooks.financial_year_id and y.church_id = reconciliation_workbooks.church_id)
);
comment on table public.reconciliation_workbooks is 'Latest Excel reconciliation source per church and financial year; does not create or modify transactions.';
notify pgrst, 'reload schema';
commit;
