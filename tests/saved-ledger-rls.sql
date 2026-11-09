-- All verification writes are confined to the new table and rolled back.
-- Select identity/scope internally; never return profile or financial records.
begin;
select set_config('request.jwt.claims', (
 select json_build_object('sub',p.id,'role','authenticated')::text
 from public.profiles p join public.financial_years y on y.church_id=p.church_id
 where p.is_active and not exists(select 1 from public.reconciliation_workbooks w where w.church_id=y.church_id and w.financial_year_id=y.id)
 limit 1
),true);
set local role authenticated;
do $$
declare scope_church uuid; scope_year uuid; visible_count integer; saved_actor uuid; saved_time timestamptz;
begin
 select p.church_id into scope_church from public.profiles p where p.id=auth.uid() and p.is_active;
 select y.id into scope_year from public.financial_years y where y.church_id=scope_church
 and not exists(select 1 from public.reconciliation_workbooks w where w.church_id=y.church_id and w.financial_year_id=y.id) limit 1;
 if scope_church is null or scope_year is null then raise exception 'No unused authorized scope available for rollback-only verification'; end if;
 insert into public.reconciliation_workbooks(church_id,financial_year_id,file_name,file_size,file_base64,uploaded_by,uploaded_at)
 values(scope_church,scope_year,'synthetic-verification.xlsx',7,encode(convert_to('fixture','UTF8'),'base64'),'00000000-0000-4000-8000-000000000001','1900-01-01');
 select uploaded_by,uploaded_at into saved_actor,saved_time from public.reconciliation_workbooks where church_id=scope_church and financial_year_id=scope_year;
 if saved_actor<>auth.uid() or saved_time<now()-interval '1 minute' then raise exception 'Server upload stamp failed'; end if;
 insert into public.reconciliation_workbooks(church_id,financial_year_id,file_name,file_size,file_base64)
 values(scope_church,scope_year,'synthetic-replacement.xls',7,encode(convert_to('updated','UTF8'),'base64'))
 on conflict(church_id,financial_year_id) do update set file_name=excluded.file_name,file_size=excluded.file_size,file_base64=excluded.file_base64;
 select count(*) into visible_count from public.reconciliation_workbooks where church_id=scope_church and financial_year_id=scope_year and file_name='synthetic-replacement.xls';
 if visible_count<>1 then raise exception 'Latest workbook replacement failed'; end if;
 begin
  insert into public.reconciliation_workbooks(church_id,financial_year_id,file_name,file_size,file_base64)
  values('00000000-0000-4000-8000-000000000099',scope_year,'denied.xlsx',1,'AA==');
  raise exception 'Cross-church write unexpectedly succeeded';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.reconciliation_workbooks(church_id,financial_year_id,file_name,file_size,file_base64)
  values(scope_church,'00000000-0000-4000-8000-000000000099','denied.xlsx',1,'AA==');
  raise exception 'Wrong-year write unexpectedly succeeded';
 exception when insufficient_privilege then null; end;
 if has_table_privilege('authenticated','public.reconciliation_workbooks','DELETE') then raise exception 'Unexpected delete permission'; end if;
 perform set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000098","role":"authenticated"}',true);
 select count(*) into visible_count from public.reconciliation_workbooks where church_id=scope_church;
 if visible_count<>0 then raise exception 'Unaffiliated user can read saved ledgers'; end if;
end;
$$;
set local role anon;
do $$ begin
 begin perform 1 from public.reconciliation_workbooks; raise exception 'Anonymous ledger access unexpectedly succeeded';
 exception when insufficient_privilege then null; end;
end; $$;
rollback;
select 'PASS: save/replace, server stamps, church/year isolation, anonymous denial; all fixture writes rolled back' as result;
