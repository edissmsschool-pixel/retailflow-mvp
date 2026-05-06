# Plan: UI Polish, Admin Controls, and Bug Sweep

## 1. UI/UX polish & responsiveness (no redesign)

Apply a consistent set of fixes across all pages. Patterns:

- **Containers**: standardize `container px-3 py-4 sm:px-6 sm:py-6` everywhere (Sales, Reports, Shifts, Staff, Settings, Products, Dashboard).
- **Tables → cards on mobile**: in `Sales`, `Staff`, `Shifts`, `Products`, wrap `<Table>` in `hidden md:block` and add a mobile `space-y-2` card list rendering the same rows for `<md`.
- **Sticky page actions**: page-level primary buttons (Add staff, Add product, Export) become full-width on mobile and pinned to the page header row.
- **Touch targets**: bump interactive controls to `h-11`/`h-12` on mobile, increase tap area on icon buttons to `h-10 w-10`.
- **Headers**: `PageHeader` actions stack vertically on `<sm`, with `flex-wrap gap-2`.
- **Dialogs**: ensure `max-h-[90dvh] overflow-y-auto` and `w-[calc(100vw-1.5rem)]` on small screens for `PaymentDialog`, `ReceiptDialog`, `ImportDialog`, Staff add, etc.
- **Landscape phones**: keep existing `landscape:` POS work; extend the same pattern (compact headers, `100dvh`) to Shifts close-out and Receipt dialogs.
- **Tablet (md)**: ensure two-column layouts kick in at `md` for Dashboard chart row, Products list+filters, Reports filters+chart.
- **Bottom nav clearance**: every page's main scroll container honors `pb-nav` already set on `<main>`; verify no page content gets hidden behind the bar.
- **Charts**: wrap recharts containers with `min-h-[220px]` and ensure parent `h-64` collapses gracefully on narrow widths.
- **Empty/loading states**: add lightweight skeletons or "No data" rows where currently blank (Sales table, Reports, Shifts list, Staff list).

No new design tokens — uses existing semantic tokens and Tailwind utilities.

## 2. Admin: user deletion (soft + hard) + signup toggle

### Staff page (`src/pages/Staff.tsx`)
Per-row action menu (DropdownMenu) with:
- **Deactivate / Reactivate** (existing `profiles.active` toggle).
- **Delete permanently** — confirms via `AlertDialog`, calls a new edge function `admin-delete-user` with `{ user_id }`. Disallowed for self.

### New edge function `admin-delete-user`
- Verifies caller JWT and `has_role(admin)`.
- Refuses if `user_id === caller.id` or if it's the last admin.
- Uses service role: deletes from `user_roles`, `push_subscriptions`, `profiles`, then `auth.admin.deleteUser(user_id)`.
- Sales/shifts history is preserved (cashier_id becomes orphan UUID — acceptable per your choice).

### Settings → Auth controls (admin only)
New card in `src/pages/Settings.tsx`:
- **Public sign-ups** switch. Calls a new edge function `admin-set-auth-config` that uses the Cloud Management API to set `disable_signup`. Reads current value on mount.
- **Leaked-password protection (HIBP)** switch (free win, same endpoint).
- Auth page (`src/pages/Auth.tsx`) hides the "Create account" tab when an unauthenticated probe (`signUp` with throwaway returns "Signups not allowed") indicates disabled — simpler: fetch a small public flag from a new `public_auth_config` view exposed by an edge function `get-auth-config` (no secrets).

### Migration
None required for tables. Add a `prevent_last_admin_delete` constraint via trigger on `user_roles` that raises if removing the last admin role.

## 3. Bug sweep — critical flows + console/network audit

Run through:
- **Auth**: email sign-in, Google OAuth, forgot-password email send, signup gated by toggle.
- **POS**: start shift (with denomination), search, scan, add to cart, line discount, hold + recall, checkout (cash + non-cash), receipt dialog open + print.
- **Shifts**: list, close shift with denomination counter, Z-report renders.
- **Sales**: list, filter, refund partial + full, void, CSV export.
- **Products**: create, edit, image upload, import, low-stock filter, stock adjust.
- **Reports**: load all date ranges without 1000-row truncation surprises.
- **Settings**: logo upload, push toggle, store info save, new auth toggles.
- **Staff**: add, role change, deactivate, delete (new).

For each, use the browser tool at 360px and 1024px, capture console + network errors, fix any 4xx/5xx or runtime errors found.

## Technical details

**Files to edit**
- Layouts/responsive polish: `src/pages/Sales.tsx`, `Reports.tsx`, `Shifts.tsx`, `Staff.tsx`, `Products.tsx`, `Dashboard.tsx`, `Settings.tsx`; `src/components/PageHeader.tsx`; `src/components/pos/PaymentDialog.tsx`, `ReceiptDialog.tsx`; `src/components/products/ImportDialog.tsx`; `src/components/shifts/ZReport.tsx`, `DenominationCounter.tsx`.
- Admin controls: `src/pages/Staff.tsx`, `src/pages/Settings.tsx`, `src/pages/Auth.tsx`.
- New: `supabase/functions/admin-delete-user/index.ts`, `supabase/functions/admin-set-auth-config/index.ts`, `supabase/functions/get-auth-config/index.ts`.
- Migration: trigger to prevent removing last admin.

**Edge function security**
All three new functions: validate JWT in code, check `has_role(admin)`, return CORS headers, validate input with zod-style guards.

**Out of scope**
- No visual redesign / new design tokens.
- No changes to business logic (checkout, refund, shift math).
- No new features beyond the three asked for.
