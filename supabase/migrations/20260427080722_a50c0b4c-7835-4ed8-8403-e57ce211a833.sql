-- =============================================================
-- 1. Storage buckets for product images and store assets
-- =============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('store-assets', 'store-assets', true)
ON CONFLICT (id) DO NOTHING;

-- product-images policies
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
CREATE POLICY "Public read product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Mgr upload product images" ON storage.objects;
CREATE POLICY "Mgr upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images' AND public.is_manager_or_admin(auth.uid()));

DROP POLICY IF EXISTS "Mgr update product images" ON storage.objects;
CREATE POLICY "Mgr update product images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND public.is_manager_or_admin(auth.uid()));

DROP POLICY IF EXISTS "Mgr delete product images" ON storage.objects;
CREATE POLICY "Mgr delete product images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND public.is_manager_or_admin(auth.uid()));

-- store-assets policies
DROP POLICY IF EXISTS "Public read store assets" ON storage.objects;
CREATE POLICY "Public read store assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'store-assets');

DROP POLICY IF EXISTS "Admin upload store assets" ON storage.objects;
CREATE POLICY "Admin upload store assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'store-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admin update store assets" ON storage.objects;
CREATE POLICY "Admin update store assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'store-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admin delete store assets" ON storage.objects;
CREATE POLICY "Admin delete store assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'store-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- =============================================================
-- 2. Shift reconciliation columns
-- =============================================================
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS counted_cash_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS expected_cash_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS totals_by_method jsonb;

-- =============================================================
-- 3. Updated close_shift function (additive: also records breakdown + totals)
-- =============================================================
CREATE OR REPLACE FUNCTION public.close_shift(
  _shift_id uuid,
  _counted_cash_kobo integer,
  _notes text,
  _counted_breakdown jsonb DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_shift RECORD;
  v_expected integer;
  v_totals jsonb;
BEGIN
  SELECT * INTO v_shift FROM public.shifts WHERE id = _shift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shift not found'; END IF;
  IF v_shift.status = 'closed' THEN RAISE EXCEPTION 'Shift already closed'; END IF;

  SELECT COALESCE(SUM(total_kobo),0) INTO v_expected
    FROM public.sales
    WHERE shift_id = _shift_id AND payment_method = 'cash' AND status <> 'voided';

  v_expected := v_expected + v_shift.opening_float_kobo;

  -- Snapshot of totals by payment method (excluding voided sales)
  SELECT jsonb_object_agg(payment_method::text, total)
    INTO v_totals
  FROM (
    SELECT payment_method, COALESCE(SUM(total_kobo),0)::integer AS total
      FROM public.sales
     WHERE shift_id = _shift_id AND status <> 'voided'
     GROUP BY payment_method
  ) t;

  UPDATE public.shifts
    SET closed_at = now(),
        expected_cash_kobo = v_expected,
        counted_cash_kobo = _counted_cash_kobo,
        counted_cash_breakdown = _counted_breakdown,
        totals_by_method = COALESCE(v_totals, '{}'::jsonb),
        variance_kobo = _counted_cash_kobo - v_expected,
        status = 'closed',
        notes = _notes
    WHERE id = _shift_id;
END; $function$;