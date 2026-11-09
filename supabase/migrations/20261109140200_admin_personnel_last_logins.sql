-- Only active church administrators can read sign-in timestamps.
CREATE OR REPLACE FUNCTION public.admin_personnel_last_logins()
RETURNS TABLE(profile_id uuid, last_sign_in_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE caller_church uuid;
BEGIN
  SELECT p.church_id INTO caller_church FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_active;
  IF caller_church IS NULL THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT p.id, u.last_sign_in_at FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id WHERE p.church_id = caller_church;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_personnel_last_logins() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_personnel_last_logins() TO authenticated;
NOTIFY pgrst, 'reload schema';
