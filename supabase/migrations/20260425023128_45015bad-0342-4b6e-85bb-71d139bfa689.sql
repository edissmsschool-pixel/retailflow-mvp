
-- 1. Add foreign keys from public tables to public.profiles so PostgREST can embed
ALTER TABLE public.sales
  ADD CONSTRAINT sales_cashier_id_profiles_fkey
  FOREIGN KEY (cashier_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.shifts
  ADD CONSTRAINT shifts_cashier_id_profiles_fkey
  FOREIGN KEY (cashier_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.held_sales
  ADD CONSTRAINT held_sales_cashier_id_profiles_fkey
  FOREIGN KEY (cashier_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_performed_by_profiles_fkey
  FOREIGN KEY (performed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Enforce unique SKU
CREATE UNIQUE INDEX IF NOT EXISTS products_sku_key ON public.products(sku);

-- 3. is_admin helper
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin') $$;

-- 4. Next SKU generator
CREATE OR REPLACE FUNCTION public.next_sku(_prefix text)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_next int;
  v_prefix text := upper(regexp_replace(coalesce(_prefix, 'GEN'), '[^A-Za-z0-9]', '', 'g'));
BEGIN
  IF v_prefix = '' THEN v_prefix := 'GEN'; END IF;
  SELECT COALESCE(MAX((regexp_replace(sku, '^' || v_prefix || '-0*', ''))::int), 0) + 1
    INTO v_next
    FROM public.products
    WHERE sku ~ ('^' || v_prefix || '-[0-9]+$');
  RETURN v_prefix || '-' || lpad(v_next::text, 3, '0');
END $$;

-- 5. Push subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own push subs"
  ON public.push_subscriptions FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Mgr read push subs"
  ON public.push_subscriptions FOR SELECT
  TO authenticated
  USING (public.is_manager_or_admin(auth.uid()));
