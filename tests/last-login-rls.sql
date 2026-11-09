begin;
select set_config('request.jwt.claims',(select json_build_object('sub',id,'role','authenticated')::text from public.profiles where role='admin' and is_active limit 1),true);
do $$
declare cid uuid; other_id uuid;
begin
select church_id into cid from public.profiles where id=auth.uid();
if cid is null then raise exception 'Admin fixture unavailable'; end if;
if exists(select 1 from public.admin_personnel_last_logins() r join public.profiles p on p.id=r.profile_id left join auth.users u on u.id=p.id where p.church_id<>cid or r.last_sign_in_at is distinct from u.last_sign_in_at) then raise exception 'Incorrect results'; end if;
if (select count(*) from public.admin_personnel_last_logins())<>(select count(*) from public.profiles where church_id=cid) then raise exception 'Incomplete results'; end if;
select id into other_id from public.profiles where role<>'admin' and is_active limit 1;
if other_id is null then raise exception 'Non-admin fixture unavailable'; end if;
perform set_config('request.jwt.claims',json_build_object('sub',other_id,'role','authenticated')::text,true);
begin perform public.admin_personnel_last_logins(); raise exception 'Non-admin allowed'; exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
begin perform public.admin_personnel_last_logins(); raise exception 'Anonymous allowed'; exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'PASS: scoped timestamps match auth source; non-admin and anonymous denied' as result;
