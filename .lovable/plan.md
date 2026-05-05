# POS Landscape Optimization + Feature Audit

## Part 1 — POS: True multi-orientation responsive layout

The current POS is optimized for portrait phones and large desktops, but breaks down in two cases:

- **Landscape phones (e.g. 740×360):** the sticky search + categories + sticky bottom cart bar + bottom nav consume nearly all vertical space, leaving ~1 row of products visible.
- **Small tablets in portrait (768–1024):** still uses the single-column mobile layout instead of revealing the side cart.
- **Tablet landscape (1024+):** already shows the side cart; needs minor polish.

### Changes in `src/pages/POS.tsx`

1. **Orientation-aware layout switch.** Use a `landscape:` Tailwind variant + `useIsMobile`-style media query so that on short viewports (`max-height: 500px`) the layout collapses the sticky search/categories into a single compact row and reduces vertical paddings (`py-1`, `h-10` inputs, `h-10` cart bar, `gap-1.5`).
2. **Reveal the side cart earlier.** Change the grid breakpoint from `lg:grid-cols-[1fr_400px]` to `md:grid-cols-[1fr_360px] xl:grid-cols-[1fr_420px]` so iPads and landscape tablets show the cart inline instead of as a bottom sheet. Hide the sticky mobile checkout bar from `md:` upward (currently `lg:hidden`).
3. **Scrollable product area sized by `dvh`.** Replace `h-[calc(100vh-26rem)]` with `h-[calc(100dvh-22rem)] landscape:h-[calc(100dvh-12rem)] md:h-[calc(100dvh-15rem)]` so the product grid always fills the remaining space without overflow on rotation.
4. **Sticky search/category collapse.** Wrap the category chips in a `landscape:hidden sm:flex` container with a "Filters" pill that opens a small Popover when hidden, so landscape phone users still get categories without losing rows.
5. **Bottom nav clearance.** Use the existing `pb-nav` utility plus `env(safe-area-inset-bottom)` on the sticky cart bar instead of the hard-coded `bottom: calc(4rem + …)` so it adapts to landscape (where bottom nav is hidden via `lg:hidden` already — hide the cart bar too when md+).
6. **Touch density.** Keep all primary touch targets ≥ 44px; in landscape allow dense mode (40px) for secondary buttons only.

### Changes in `src/components/pos/ProductGrid.tsx`

- Adjust grid: `grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 landscape:grid-cols-3 landscape:sm:grid-cols-4`.
- In `landscape:` reduce thumbnail to `aspect-[4/3]` and card padding to `p-2` so 2 rows fit on a 360px-tall phone.

### Changes in `src/components/pos/CartList.tsx` & `CartSummary.tsx`

- Drop the per-line "Line discount" input behind a small "Add discount" toggle — it currently bloats every row on mobile.
- Make the qty stepper compact (`h-9 w-9`) on landscape.
- Combine Items/Subtotal/Discount into a single 2-column row on `landscape:` to save vertical space.

### Acceptance check (visual)

- 360×800 portrait phone: 4 products visible, sticky bar pinned, cart drawer opens smoothly.
- 740×360 landscape phone: search + categories collapsed into one row, ≥ 6 products visible (2 rows of 3), sticky cart bar still tappable.
- 820×1180 iPad portrait: side cart visible (no bottom sheet).
- 1366×768 desktop: unchanged from current good layout.

---

## Part 2 — Cross-page feature audit and gap fill

Review of the 9 routes (`Dashboard`, `POS`, `Products`, `Sales`, `Reports`, `Shifts`, `Staff`, `Settings`, `Auth`). Below is what looks present vs. missing/broken based on the current files. I will fix the **High** items and confirm the **Medium** ones with you before doing them.

### POS — High
- Held-sales **search** + ability to **edit** before recall (currently delete-only).
- Wire keyboard shortcuts: `F2` focus search, `F4` open payment, `Esc` close drawers.
- Show **shift status** (opened time + sales count) in the header chip; clicking it opens shift summary.

### Products — High / Medium
- Confirm **bulk image upload** + **CSV import** path (`ImportDialog` + `ImageUploader` exist) — verify error toasts and progress.
- Add **low-stock filter** chip and **sort by stock** toggle.
- Inline **stock adjust** modal calling `adjust-stock` edge function (exists) — verify it's reachable from the row.

### Sales — High
- **Refund / void** flow buttons should call `refund-sale` and `void-sale` edge functions; verify role gating.
- Add **date range filter** + CSV export (`src/lib/csv.ts` already exists).
- Receipt re-print from row.

### Reports — Medium
- Verify date-range, payment-method breakdown, top products, and cashier performance widgets render with empty-state.
- Add CSV export per chart.

### Shifts — High
- **Close shift** flow with `DenominationCounter` + variance, calling `close-shift` edge function. `ZReport` component exists — wire a "Print Z-report" button.
- Manager view: list all open shifts with force-close.

### Staff — Medium
- Create staff via `admin-create-staff` edge function (exists). Verify role assignment UI writes to `user_roles`.
- Toggle active / reset password.

### Settings — Medium
- Store profile (name, address, phone, logo, receipt footer) — verify persists to `store_settings`.
- Multi-store switcher via `StoresManager` — verify `useActiveStore` selection.
- Idle lock settings (`IdleLockSettings`) — verify timeout persists.
- Push notifications enable button calling `register-push` edge function.

### Auth — High
- Confirm email/password login + Google OAuth button present (per project rules: "Add google authentication unless user explicitly asks to not"). If missing, add Google sign-in.
- Forgot-password link.

### Cross-cutting — High
- Replace any `100vh` with `100dvh` on full-height screens (mobile browser chrome bug).
- Ensure every page has the `pb-nav` bottom padding so the bottom nav doesn't cover content.
- Hook up `OfflineBanner` action — verify SW (`public/sw.js`) caches POS and Products lists for offline reads.

---

## Suggested execution order

1. POS landscape + tablet layout (Part 1) — single PR.
2. POS feature polish (held search, shortcuts, shift chip).
3. Sales refund/void/export.
4. Shifts close-flow + Z-report.
5. Products low-stock filter + stock adjust.
6. Auth Google + forgot password.
7. Settings/Staff polish.

## Decision needed before I start

Part 1 is uncontroversial — I will implement it as described.

For Part 2, please confirm:
- **A.** Implement all "High" items now in one pass (POS shortcuts, Sales refund/void/export, Shifts close + Z-report, Auth Google).
- **B.** Only implement POS-related Highs now; queue the rest.
- **C.** Different scope (tell me which).

If you don't reply, I'll proceed with **A**.
