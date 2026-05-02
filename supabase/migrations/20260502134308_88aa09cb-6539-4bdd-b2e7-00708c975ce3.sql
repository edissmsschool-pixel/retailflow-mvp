ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_cashier_id_profiles_fkey;
ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS shifts_cashier_id_profiles_fkey;
ALTER TABLE public.held_sales DROP CONSTRAINT IF EXISTS held_sales_cashier_id_profiles_fkey;