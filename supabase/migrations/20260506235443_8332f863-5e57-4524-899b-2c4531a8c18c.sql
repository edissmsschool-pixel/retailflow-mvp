
-- 1) Settings flag
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS signups_enabled boolean NOT NULL DEFAULT true;

-- 2) Public RPC so the unauthenticated /auth page can know if signups are on
CREATE OR REPLACE FUNCTION public.get_signups_enabled()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT signups_enabled FROM public.store_settings WHERE id = 1), true)
$$;
GRANT EXECUTE ON FUNCTION public.get_signups_enabled() TO anon, authenticated;

-- 3) Prevent deleting the last admin role
CREATE OR REPLACE FUNCTION public.prevent_last_admin_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role = 'admin' THEN
    IF (SELECT COUNT(*) FROM public.user_roles WHERE role = 'admin' AND user_id <> OLD.user_id) = 0 THEN
      RAISE EXCEPTION 'Cannot remove the last admin';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_last_admin_delete_trg ON public.user_roles;
CREATE TRIGGER prevent_last_admin_delete_trg
BEFORE DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_last_admin_delete();

-- 4) Update handle_new_user to honor signups_enabled (service role bypasses)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signups_on boolean;
  v_role text;
BEGIN
  v_role := COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
  v_signups_on := COALESCE((SELECT signups_enabled FROM public.store_settings WHERE id = 1), true);

  -- Always allow when called via service role (admin-created staff). Otherwise
  -- allow first-ever signup (so an admin can be bootstrapped) and only block
  -- subsequent self-signups when the toggle is off.
  IF v_role <> 'service_role'
     AND NOT v_signups_on
     AND (SELECT COUNT(*) FROM public.user_roles) > 0 THEN
    RAISE EXCEPTION 'Public sign-ups are disabled';
  END IF;

  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;

  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cashier')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
