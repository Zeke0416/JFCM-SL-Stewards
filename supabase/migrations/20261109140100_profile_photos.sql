-- Small, normalized JPEG portraits. Existing church-scoped admin UPDATE policy
-- on profiles remains the authority; no access policy is broadened.
begin;
alter table public.profiles add column if not exists avatar_data_url text;
alter table public.profiles drop constraint if exists profiles_avatar_data_url_check;
alter table public.profiles add constraint profiles_avatar_data_url_check check (
 avatar_data_url is null or (
  octet_length(avatar_data_url) <= 200000
  and avatar_data_url ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$'
  and substring(decode(split_part(avatar_data_url, ',', 2), 'base64') from 1 for 3) = decode('ffd8ff','hex')
 )
);
comment on column public.profiles.avatar_data_url is 'Admin-managed 256px JPEG portrait data URL; nullable when no photo is set.';
notify pgrst, 'reload schema';
commit;
