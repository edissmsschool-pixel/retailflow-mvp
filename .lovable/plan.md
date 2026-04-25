## Goals

1. Fix the bug that's breaking Sales/Reports/Shifts/Staff pages today.
2. Make role-based access airtight on the server.
3. Auto-generate SKUs for new products.
4. Add a bulk CSV import/update tool for products.
5. Add web push notifications (low stock + new sale alerts).
6. Spot-check the rest of the app and fix anything else that's broken.

---

## 1. Fix the broken FK relationship (root cause of current 400 errors)

The Sales page is failing with:

> Could not find a relationship between 'sales' and 'cashier_id' in the schema cache

Why: `sales.cashier_id` has a FK to `auth.users`, not to `public.profiles`. PostgREST can only embed `profiles:cashier_id(full_name)` if a FK exists between those two **public** tables. Same problem for `shifts.cashier_id`, `held_sales.cashier_id`, and `user_roles.user_id` (used implicitly through Staff page joins).

Fix (migration):
- Add FKs from `sales.cashier_id`, `shifts.cashier_id`, `held_sales.cashier_id`, `user_roles.user_id`, and `stock_movements.performed_by` → `public.profiles(id) ON DELETE SET NULL` (or RESTRICT for user_roles). The profiles row already exists for every auth user (created by the `handle_new_user` trigger), so this is safe.
- After the migration, the existing `profiles:cashier_id(full_name)` and `user_roles(role)` embeds will start resolving correctly. **No client-side changes needed for this fix** — the pages will start working immediately.

Pages that recover automatically: **Sales, Reports, Shifts, Staff**.

---

## 2. Role-based access audit & hardening

Current state is mostly good (RLS uses `has_role` / `is_manager_or_admin` / `is_staff` security-definer functions, no recursive policies, roles in a separate `user_roles` table). Remaining gaps:

- **`profiles` SELECT** is gated by `is_staff` — fine, but cashiers can read every staff member's name + phone. Tighten to: cashier sees only own row + minimal display name of co-workers; admin/manager see everything.
- **`store_settings` UPDATE** is admin-only — good. Add an explicit policy for staff to read (already there via `is_staff`).
- **`held_sales`** allows ALL on own rows — fine.
- **`stock_movements`** has read-only for staff; INSERTs only happen via security-definer RPCs — good.
- **Sales detail RLS**: `sale_items` SELECT lets the original cashier see their own. After voiding, this still works — confirmed correct.
- Add a server-side `is_admin(uuid)` helper for symmetry (cosmetic).
- Front-end: `ProtectedRoute` already guards routes. Add an in-page guard for `/staff` actions (e.g., the "Add staff" button is only rendered if `hasRole('admin')` is true — already enforced by route, but I'll add a defensive check inside the page too).

No data-leak vulnerabilities found. Changes are minor tightening.

---

## 3. Auto-generate SKUs

In the Products dialog, when creating a new product:
- Add a "Generate" button next to the SKU field, and auto-generate on first focus if the field is blank.
- Format: `<CAT>-<SEQ>` where `<CAT>` is the first 3 letters of the selected category (uppercase, e.g. `BEV`, `GRO`, `SNK`) — fall back to `GEN` if no category.
- `<SEQ>` is a zero-padded incrementing counter scoped to the category, computed by querying the max existing SKU in that category and adding 1 (e.g. `BEV-014`).
- Done client-side with a single `select sku from products where sku ilike 'BEV-%'` query, so it's unique without needing a sequence.
- Variants/combinations: if the user later adds a variant on an existing product, append `-V<n>` (e.g. `BEV-014-V2`). For now there is no variants table, so this is just future-proof formatting; the same generator handles it.
- A unique constraint on `products.sku` already exists implicitly via app logic — I'll add an explicit `UNIQUE` index to the DB to prevent races.

---

## 4. Bulk product import / editor

New "Import" button on the Products page → opens a dialog that accepts a CSV file.

**Columns supported** (header row required, case-insensitive):
`sku, name, barcode, category, cost_price, sell_price, stock_qty, reorder_level, active`

Behavior:
- Parse client-side with a tiny CSV reader (no new dep — use the existing `lib/csv.ts` helper extended with a `parseCsv` function).
- For each row: if `sku` already exists → UPDATE that product; otherwise INSERT a new product. (Upsert by SKU.)
- `category` is matched by name (case-insensitive); if missing, auto-create the category.
- Prices are entered in naira and converted to kobo before write.
- Show a preview table (first 20 rows) with row-level validation (red border on errors), then a "Confirm import" button.
- On submit, batch in chunks of 200 via `supabase.from("products").upsert(..., { onConflict: "sku" })`.
- Show a summary toast: "Created X, updated Y, skipped Z (errors)."
- Add an "Export template CSV" button so users get a correctly formatted starter file.

This is the "bulk editor" the user asked for — handles thousands of rows without touching the UI per product.

---

## 5. Push notifications

Use the **Web Push** standard (works on Chrome/Edge/Firefox/Android, plus iOS 16.4+ when installed as a PWA).

Setup:
- Generate a VAPID keypair once and store the **public** key in a new `store_settings.vapid_public_key` column (or a constant), and the **private** key in a Supabase secret `VAPID_PRIVATE_KEY` for the edge function to sign with.
- New table `push_subscriptions(id, user_id, endpoint, p256dh, auth, created_at)` with RLS so users only see/manage their own subscriptions.
- Add a service worker `public/sw.js` that listens for `push` events and shows a notification.
- Add a small "Enable notifications" toggle in Settings → calls `Notification.requestPermission()`, registers the SW, calls `pushManager.subscribe({ applicationServerKey: vapidPublic })`, posts the result to a new edge function `register-push` that inserts into `push_subscriptions`.
- New edge function `send-push` that takes `{ user_ids?: uuid[], roles?: Role[], title, body, url? }`, looks up matching subscriptions, signs and POSTs to each endpoint using the Web Push protocol (use the `web-push` npm package via esm.sh import in Deno).
- **Triggers** (server-side):
  - Inside `process_checkout` RPC, after a successful sale, enqueue a "New sale" notification for all admins/managers (calls `send-push` via `pg_net`, or simpler: do it from the existing `checkout` edge function right after the RPC succeeds, so we stay in TypeScript).
  - Inside `adjust-stock` and `process_refund`, after the update, check if the product's `stock_qty <= reorder_level` and fire a "Low stock" notification (also done in the edge function layer, not the SQL).
- Permissions are stored per device, so a single user logging in on phone + laptop gets two subscription rows; both are notified.

The user gets a real OS-level notification ("New sale ₦7,300 — Cashier: John") even when the tab is closed (on desktop and Android).

---

## 6. Step-by-step QA pass + bug fixes

After the FK migration deploys, I'll click through each route as admin:

| Page | What I verify |
|------|---------------|
| Dashboard | Tiles load, no console errors |
| POS | Add to cart → checkout cash → receipt prints automatically |
| Products | Create / edit / adjust stock; new "Generate SKU" + "Import CSV" buttons work |
| Sales | List loads (FK fix), open a sale, refund 1 item, void sale |
| Reports | All charts populate, CSV exports |
| Shifts | Open shift from POS, close shift, variance calculates |
| Staff | List loads with roles, add new staff, change role, deactivate |
| Settings | Update store name + receipt footer; toggle push notifications |

Anything that throws will get a follow-up fix in the same pass. I'll also re-check the security scanner after the migration.

---

## Files & changes

**Migration (one):**
- Add FKs (`sales`, `shifts`, `held_sales`, `user_roles`, `stock_movements`) → `profiles`.
- Add `UNIQUE` on `products.sku`.
- Add `push_subscriptions` table + RLS.

**Edge functions:**
- New: `register-push/index.ts`, `send-push/index.ts`.
- Edit: `checkout/index.ts` (fire low-stock + new-sale push after success), `refund-sale/index.ts`, `adjust-stock/index.ts` (low-stock push).

**Front-end:**
- `src/lib/sku.ts` — SKU generator.
- `src/lib/csv.ts` — extend with `parseCsv`.
- `src/components/products/ImportDialog.tsx` — new bulk import UI.
- `src/pages/Products.tsx` — wire up Generate-SKU button + Import dialog.
- `src/pages/Settings.tsx` — push-notification toggle.
- `public/sw.js` — service worker for push display.
- `src/main.tsx` — register the service worker.

**No client changes needed** for Sales/Reports/Shifts/Staff fixes — the migration alone fixes them.

---

## Verification checklist (after build)

- [ ] Sales page lists today's sales without 400.
- [ ] Reports "Sales by cashier" table shows real names.
- [ ] Staff page shows role dropdowns populated correctly.
- [ ] Creating a new product with a category auto-fills SKU like `BEV-014`.
- [ ] Importing a 50-row CSV upserts cleanly and shows a summary toast.
- [ ] Allowing notifications + completing a sale shows an OS-level toast on a second device.
- [ ] Security scan shows no new errors.
