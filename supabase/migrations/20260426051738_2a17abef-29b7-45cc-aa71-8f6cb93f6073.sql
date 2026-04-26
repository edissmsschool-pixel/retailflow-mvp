-- Drop any partially-applied FKs of these names so the migration is idempotent.
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_cashier_id_fkey;
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_shift_id_fkey;
ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS shifts_cashier_id_fkey;
ALTER TABLE public.held_sales DROP CONSTRAINT IF EXISTS held_sales_cashier_id_fkey;
ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_product_id_fkey;
ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_performed_by_fkey;
ALTER TABLE public.sale_items DROP CONSTRAINT IF EXISTS sale_items_sale_id_fkey;
ALTER TABLE public.sale_items DROP CONSTRAINT IF EXISTS sale_items_product_id_fkey;
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_profiles_fkey;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_id_fkey;

-- Cashier → profile relationships (needed for PostgREST embedded selects).
ALTER TABLE public.sales
  ADD CONSTRAINT sales_cashier_id_fkey
  FOREIGN KEY (cashier_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.shifts
  ADD CONSTRAINT shifts_cashier_id_fkey
  FOREIGN KEY (cashier_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.held_sales
  ADD CONSTRAINT held_sales_cashier_id_fkey
  FOREIGN KEY (cashier_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.sales
  ADD CONSTRAINT sales_shift_id_fkey
  FOREIGN KEY (shift_id) REFERENCES public.shifts(id) ON DELETE SET NULL;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_performed_by_fkey
  FOREIGN KEY (performed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.sale_items
  ADD CONSTRAINT sale_items_sale_id_fkey
  FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;

ALTER TABLE public.sale_items
  ADD CONSTRAINT sale_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.products
  ADD CONSTRAINT products_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

-- Helpful supporting indexes for the new FKs.
CREATE INDEX IF NOT EXISTS idx_sales_cashier_id ON public.sales(cashier_id);
CREATE INDEX IF NOT EXISTS idx_sales_shift_id ON public.sales(shift_id);
CREATE INDEX IF NOT EXISTS idx_shifts_cashier_id ON public.shifts(cashier_id);
CREATE INDEX IF NOT EXISTS idx_held_sales_cashier_id ON public.held_sales(cashier_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_performed_by ON public.stock_movements(performed_by);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON public.sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);