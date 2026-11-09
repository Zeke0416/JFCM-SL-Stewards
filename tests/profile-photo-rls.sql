begin;
select set_config('request.jwt.claims',(select json_build_object('sub',id,'role','authenticated')::text from public.profiles where role='admin' and is_active limit 1),true);
set local role authenticated;
do $$
declare admin_id uuid:=auth.uid(); non_admin_id uuid; changed integer;
 photo text:='data:image/jpeg;base64,'||encode(decode('ffd8ffe000104a46494600010100000100010000ffd9','hex'),'base64');
begin
 if admin_id is null then raise exception 'No authorized admin available for rollback-only verification'; end if;
 update public.profiles set avatar_data_url=photo where id=admin_id;
 get diagnostics changed = row_count;
 if changed<>1 then raise exception 'Admin photo update denied'; end if;
 update public.profiles set avatar_data_url=null where id=admin_id;
 get diagnostics changed = row_count;
 if changed<>1 then raise exception 'Admin photo removal denied'; end if;
 begin update public.profiles set avatar_data_url='data:image/svg+xml;base64,PHN2Zz4=' where id=admin_id; raise exception 'Unsafe format accepted';
 exception when check_violation or invalid_parameter_value then null; end;
 begin update public.profiles set avatar_data_url='data:image/jpeg;base64,'||repeat('A',200001) where id=admin_id; raise exception 'Oversize avatar accepted';
 exception when check_violation or invalid_parameter_value then null; end;
 select id into non_admin_id from public.profiles where role<>'admin' and is_active limit 1;
 if non_admin_id is null then raise exception 'No non-admin identity available for permission verification'; end if;
 perform set_config('request.jwt.claims',json_build_object('sub',non_admin_id,'role','authenticated')::text,true);
 update public.profiles set avatar_data_url=photo where id=admin_id;
 get diagnostics changed = row_count;
 if changed<>0 then raise exception 'Non-admin photo update unexpectedly allowed'; end if;
end; $$;
rollback;
select 'PASS: admin photo update/removal, non-admin denial, unsafe-format/size checks; all changes rolled back' as result;
