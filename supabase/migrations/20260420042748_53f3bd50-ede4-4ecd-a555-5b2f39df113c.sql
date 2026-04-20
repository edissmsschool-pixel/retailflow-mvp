-- =========================================
-- Retail MVP: schema, roles, RLS, triggers
-- =========================================

-- Roles enum + user_roles
CREATE TYPE public.app_role AS ENUM ('admin','manager','cashier');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','manager'))
$$;

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;

  -- First user becomes admin, otherwise default cashier
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cashier')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Products (prices in kobo: integer)
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text NOT NULL UNIQUE,
  barcode text UNIQUE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  cost_price_kobo integer NOT NULL DEFAULT 0 CHECK (cost_price_kobo >= 0),
  sell_price_kobo integer NOT NULL DEFAULT 0 CHECK (sell_price_kobo >= 0),
  stock_qty integer NOT NULL DEFAULT 0,
  reorder_level integer NOT NULL DEFAULT 5,
  image_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_name ON public.products (lower(name));
CREATE INDEX idx_products_category ON public.products (category_id);

-- Stock movements (audit)
CREATE TYPE public.stock_movement_type AS ENUM ('sale','refund','adjustment_in','adjustment_out','restock','damage','correction','void');

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  change_qty integer NOT NULL,           -- positive or negative
  movement_type stock_movement_type NOT NULL,
  reason text,
  reference_type text,                   -- 'sale' | 'refund' | 'adjustment'
  reference_id uuid,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_movements_product ON public.stock_movements (product_id, created_at DESC);

-- Sales
CREATE TYPE public.payment_method AS ENUM ('cash','transfer','pos_card');
CREATE TYPE public.sale_status AS ENUM ('completed','refunded','partially_refunded','voided');

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number bigserial UNIQUE,
  cashier_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  shift_id uuid,
  subtotal_kobo integer NOT NULL DEFAULT 0,
  discount_kobo integer NOT NULL DEFAULT 0,
  total_kobo integer NOT NULL DEFAULT 0,
  amount_tendered_kobo integer NOT NULL DEFAULT 0,
  change_kobo integer NOT NULL DEFAULT 0,
  payment_method payment_method NOT NULL,
  status sale_status NOT NULL DEFAULT 'completed',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_created ON public.sales (created_at DESC);
CREATE INDEX idx_sales_cashier ON public.sales (cashier_id, created_at DESC);

CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name text NOT NULL,            -- snapshot
  sku text NOT NULL,                     -- snapshot
  unit_price_kobo integer NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  line_discount_kobo integer NOT NULL DEFAULT 0,
  line_total_kobo integer NOT NULL,
  refunded_qty integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sale_items_sale ON public.sale_items (sale_id);
CREATE INDEX idx_sale_items_product ON public.sale_items (product_id);

-- Held sales (parked carts)
CREATE TABLE public.held_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text,
  cart jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Shifts
CREATE TYPE public.shift_status AS ENUM ('open','closed');

CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  opening_float_kobo integer NOT NULL DEFAULT 0,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  expected_cash_kobo integer,
  counted_cash_kobo integer,
  variance_kobo integer,
  status shift_status NOT NULL DEFAULT 'open',
  notes text
);
CREATE INDEX idx_shifts_cashier ON public.shifts (cashier_id, opened_at DESC);

-- Store settings (single row)
CREATE TABLE public.store_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  store_name text NOT NULL DEFAULT 'My Store',
  address text,
  phone text,
  receipt_footer text DEFAULT 'Thank you for your patronage!',
  logo_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.store_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- updated_at triggers
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.store_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================
-- Enable RLS
-- =========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.held_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- Profiles: every staff can view all profiles (needed to display cashier names),
-- only owner or admin can update; insert handled by trigger.
CREATE POLICY "Staff view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Owner updates profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin inserts profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR id = auth.uid());

-- user_roles: only admins manage; staff can read their own to know role
CREATE POLICY "Admin manages roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Read own role" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Categories: staff read; manager/admin write
CREATE POLICY "Staff read categories" ON public.categories
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Mgr write categories" ON public.categories
  FOR ALL TO authenticated
  USING (public.is_manager_or_admin(auth.uid()))
  WITH CHECK (public.is_manager_or_admin(auth.uid()));

-- Products: staff read; manager/admin write (stock changes go through edge fn)
CREATE POLICY "Staff read products" ON public.products
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Mgr write products" ON public.products
  FOR ALL TO authenticated
  USING (public.is_manager_or_admin(auth.uid()))
  WITH CHECK (public.is_manager_or_admin(auth.uid()));

-- Stock movements: staff read; writes via edge functions (service role) — no insert policy
CREATE POLICY "Staff read movements" ON public.stock_movements
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- Sales: cashier sees own; manager/admin sees all
CREATE POLICY "Read own sales" ON public.sales
  FOR SELECT TO authenticated
  USING (cashier_id = auth.uid() OR public.is_manager_or_admin(auth.uid()));
CREATE POLICY "Read sale items" ON public.sale_items
  FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.cashier_id = auth.uid())
  );
-- writes only via edge functions

-- Held sales: cashier owns
CREATE POLICY "Cashier own held" ON public.held_sales
  FOR ALL TO authenticated
  USING (cashier_id = auth.uid())
  WITH CHECK (cashier_id = auth.uid());

-- Shifts: cashier sees own; manager/admin sees all; cashier inserts/updates own (close goes through edge fn)
CREATE POLICY "Read shifts" ON public.shifts
  FOR SELECT TO authenticated
  USING (cashier_id = auth.uid() OR public.is_manager_or_admin(auth.uid()));
CREATE POLICY "Cashier opens own shift" ON public.shifts
  FOR INSERT TO authenticated WITH CHECK (cashier_id = auth.uid());
CREATE POLICY "Cashier updates own open shift" ON public.shifts
  FOR UPDATE TO authenticated
  USING (cashier_id = auth.uid() OR public.is_manager_or_admin(auth.uid()));

-- Store settings: staff read, admin write
CREATE POLICY "Staff read settings" ON public.store_settings
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admin writes settings" ON public.store_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================
-- Atomic checkout function (used by edge fn via service role,
-- but kept as security definer for safety)
-- =========================================
CREATE OR REPLACE FUNCTION public.process_checkout(
  _cashier uuid,
  _items jsonb,            -- [{product_id, quantity, line_discount_kobo}]
  _sale_discount_kobo integer,
  _payment_method payment_method,
  _amount_tendered_kobo integer,
  _shift_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sale_id uuid;
  v_subtotal integer := 0;
  v_total integer := 0;
  v_change integer := 0;
  v_item jsonb;
  v_product RECORD;
  v_qty integer;
  v_line_discount integer;
  v_line_total integer;
BEGIN
  IF jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  -- Lock products and validate stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_qty := (v_item->>'quantity')::int;
    v_line_discount := COALESCE((v_item->>'line_discount_kobo')::int, 0);
    SELECT id, name, sku, sell_price_kobo, stock_qty
      INTO v_product
      FROM public.products
      WHERE id = (v_item->>'product_id')::uuid
      FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product % not found', v_item->>'product_id'; END IF;
    IF v_product.stock_qty < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for %', v_product.name;
    END IF;
    v_line_total := (v_product.sell_price_kobo * v_qty) - v_line_discount;
    IF v_line_total < 0 THEN v_line_total := 0; END IF;
    v_subtotal := v_subtotal + v_line_total;
  END LOOP;

  v_total := v_subtotal - COALESCE(_sale_discount_kobo,0);
  IF v_total < 0 THEN v_total := 0; END IF;

  IF _payment_method = 'cash' AND _amount_tendered_kobo < v_total THEN
    RAISE EXCEPTION 'Insufficient cash tendered';
  END IF;

  v_change := GREATEST(_amount_tendered_kobo - v_total, 0);

  INSERT INTO public.sales (cashier_id, shift_id, subtotal_kobo, discount_kobo, total_kobo,
                            amount_tendered_kobo, change_kobo, payment_method, status)
  VALUES (_cashier, _shift_id, v_subtotal, COALESCE(_sale_discount_kobo,0), v_total,
          _amount_tendered_kobo, v_change, _payment_method, 'completed')
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_qty := (v_item->>'quantity')::int;
    v_line_discount := COALESCE((v_item->>'line_discount_kobo')::int, 0);
    SELECT id, name, sku, sell_price_kobo INTO v_product
      FROM public.products WHERE id = (v_item->>'product_id')::uuid;
    v_line_total := (v_product.sell_price_kobo * v_qty) - v_line_discount;
    IF v_line_total < 0 THEN v_line_total := 0; END IF;

    INSERT INTO public.sale_items (sale_id, product_id, product_name, sku, unit_price_kobo,
                                   quantity, line_discount_kobo, line_total_kobo)
    VALUES (v_sale_id, v_product.id, v_product.name, v_product.sku, v_product.sell_price_kobo,
            v_qty, v_line_discount, v_line_total);

    UPDATE public.products SET stock_qty = stock_qty - v_qty WHERE id = v_product.id;

    INSERT INTO public.stock_movements (product_id, change_qty, movement_type, reason,
                                        reference_type, reference_id, performed_by)
    VALUES (v_product.id, -v_qty, 'sale', 'Sale checkout', 'sale', v_sale_id, _cashier);
  END LOOP;

  RETURN v_sale_id;
END; $$;

-- Refund (manager/admin)
CREATE OR REPLACE FUNCTION public.process_refund(
  _sale_id uuid,
  _items jsonb,        -- [{sale_item_id, quantity}]
  _performed_by uuid,
  _reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item jsonb;
  v_si RECORD;
  v_qty integer;
  v_total_qty integer;
  v_remaining integer;
  v_refund_total integer := 0;
  v_line_refund integer;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_qty := (v_item->>'quantity')::int;
    SELECT * INTO v_si FROM public.sale_items
      WHERE id = (v_item->>'sale_item_id')::uuid AND sale_id = _sale_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Sale item not found'; END IF;
    IF v_qty <= 0 OR (v_si.refunded_qty + v_qty) > v_si.quantity THEN
      RAISE EXCEPTION 'Invalid refund quantity';
    END IF;
    v_line_refund := (v_si.line_total_kobo / v_si.quantity) * v_qty;
    v_refund_total := v_refund_total + v_line_refund;

    UPDATE public.sale_items SET refunded_qty = refunded_qty + v_qty WHERE id = v_si.id;
    UPDATE public.products SET stock_qty = stock_qty + v_qty WHERE id = v_si.product_id;
    INSERT INTO public.stock_movements (product_id, change_qty, movement_type, reason,
                                        reference_type, reference_id, performed_by)
    VALUES (v_si.product_id, v_qty, 'refund', _reason, 'sale', _sale_id, _performed_by);
  END LOOP;

  -- Update sale status
  SELECT SUM(quantity), SUM(refunded_qty) INTO v_total_qty, v_remaining
    FROM public.sale_items WHERE sale_id = _sale_id;
  IF v_remaining >= v_total_qty THEN
    UPDATE public.sales SET status = 'refunded' WHERE id = _sale_id;
  ELSE
    UPDATE public.sales SET status = 'partially_refunded' WHERE id = _sale_id;
  END IF;
END; $$;

-- Void sale (manager/admin) — restocks all unrefunded items
CREATE OR REPLACE FUNCTION public.process_void(
  _sale_id uuid,
  _performed_by uuid,
  _reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_si RECORD;
  v_qty integer;
BEGIN
  FOR v_si IN SELECT * FROM public.sale_items WHERE sale_id = _sale_id FOR UPDATE LOOP
    v_qty := v_si.quantity - v_si.refunded_qty;
    IF v_qty > 0 THEN
      UPDATE public.products SET stock_qty = stock_qty + v_qty WHERE id = v_si.product_id;
      INSERT INTO public.stock_movements (product_id, change_qty, movement_type, reason,
                                          reference_type, reference_id, performed_by)
      VALUES (v_si.product_id, v_qty, 'void', _reason, 'sale', _sale_id, _performed_by);
      UPDATE public.sale_items SET refunded_qty = quantity WHERE id = v_si.id;
    END IF;
  END LOOP;
  UPDATE public.sales SET status = 'voided' WHERE id = _sale_id;
END; $$;

-- Stock adjustment
CREATE OR REPLACE FUNCTION public.adjust_stock(
  _product_id uuid,
  _change_qty integer,
  _reason text,
  _performed_by uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_new integer;
BEGIN
  UPDATE public.products SET stock_qty = stock_qty + _change_qty
    WHERE id = _product_id RETURNING stock_qty INTO v_new;
  IF v_new IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
  IF v_new < 0 THEN RAISE EXCEPTION 'Stock cannot go negative'; END IF;
  INSERT INTO public.stock_movements (product_id, change_qty, movement_type, reason,
                                      reference_type, performed_by)
  VALUES (_product_id, _change_qty,
          CASE WHEN _change_qty >= 0 THEN 'adjustment_in'::stock_movement_type ELSE 'adjustment_out'::stock_movement_type END,
          _reason, 'adjustment', _performed_by);
END; $$;

-- Close shift
CREATE OR REPLACE FUNCTION public.close_shift(
  _shift_id uuid,
  _counted_cash_kobo integer,
  _notes text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_shift RECORD;
  v_expected integer;
BEGIN
  SELECT * INTO v_shift FROM public.shifts WHERE id = _shift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shift not found'; END IF;
  IF v_shift.status = 'closed' THEN RAISE EXCEPTION 'Shift already closed'; END IF;

  SELECT COALESCE(SUM(total_kobo),0) INTO v_expected
    FROM public.sales
    WHERE shift_id = _shift_id AND payment_method = 'cash' AND status <> 'voided';

  v_expected := v_expected + v_shift.opening_float_kobo;

  UPDATE public.shifts
    SET closed_at = now(),
        expected_cash_kobo = v_expected,
        counted_cash_kobo = _counted_cash_kobo,
        variance_kobo = _counted_cash_kobo - v_expected,
        status = 'closed',
        notes = _notes
    WHERE id = _shift_id;
END; $$;

-- Seed a few categories
INSERT INTO public.categories (name) VALUES ('Beverages'),('Snacks'),('Groceries'),('Household'),('Personal Care')
ON CONFLICT DO NOTHING;
