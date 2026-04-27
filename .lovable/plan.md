## Scope decisions (from your answers)

- **Multi-store**: deferred — not in this round.
- **Offline mode**: deferred — not in this round.
- **Product images**: file upload + in-app camera + AI auto-suggest from web by name.
- **End-of-day**: denomination breakdown + printable Z-report.

The remaining requests in this round:

1. Colorful, more polished navigation panel + small UI tightening.
2. Product image uploads (drag/drop, file picker, camera capture, AI fetch).
3. Cash reconciliation with denomination counter + printable EOD/Z-report.
4. Mobile responsiveness pass and full bug sweep.

---

## 1. Navigation & UI polish

Update `src/components/AppLayout.tsx` and `src/index.css`:

- Give each nav item its own accent color (e.g. POS = orange, Products = blue, Reports = violet, Sales = teal, Shifts = amber, Staff = pink, Settings = slate). Apply via a small `colorClass` field on each NAV item, used for the icon tile background and the active pill.
- Active nav item: filled gradient pill with white icon + glow, instead of the current low-contrast tint.
- Mobile bottom nav: each tab gets its own colored "blob" when active (matches the side nav colors); inactive icons remain neutral grey.
- Top bar: small store name + role badge on the right, subtle gradient bottom border.
- Add a tiny `OfflineBanner` placeholder using `navigator.onLine` so when the device drops connection the user sees a yellow strip — even without offline checkout, this is useful feedback.
- No shadcn-sidebar refactor; keep the existing top bar + bottom nav structure (works better for POS).

## 2. Product image uploads

**Storage migration**:

- Create a public `product-images` bucket via SQL migration.
- RLS: anyone authenticated can read; only managers/admins can insert/update/delete.

**Edge function `suggest-product-image`** (new):

- Input: `{ name: string }`.
- Calls Lovable AI (`google/gemini-3-flash-preview`) with a prompt asking for a single best public image URL for that product (returns JSON via tool calling: `{ image_url, source }`).
- Validates the URL, fetches it server-side, uploads to the `product-images` bucket, returns the resulting public URL. This avoids hot-linking external sites.

**`ImageUploader` component** (new — `src/components/products/ImageUploader.tsx`):

- Tabs: **Upload**, **Camera**, **AI suggest**.
- Upload tab: drag/drop + file picker. Validates type (image/*) and size (≤4MB), client-side resizes to max 1024px, uploads to `product-images/{productId or temp-uuid}.webp`.
- Camera tab: uses `getUserMedia({ video: { facingMode: "environment" } })` to show a live preview + capture button, then runs through the same resize/upload pipeline.
- AI suggest tab: button that calls `suggest-product-image` with the current name; shows the returned image with Accept/Try again.
- Shows current image + "Remove" button.

**Wire into `Products.tsx`**:

- Add `ImageUploader` inside the edit/new product dialog.
- Show product thumbnails in the products table (small avatar in the first column).
- Show the product image in the POS `ProductGrid` cards (already supports `image_url` — verify and fall back to a placeholder).

## 3. Cash reconciliation + EOD Z-report

**Schema (small, additive)**:

- Add columns to `shifts`:
  - `expected_cash_breakdown jsonb` (computed)
  - `counted_cash_breakdown jsonb` (denomination map: `{ "1000": 5, "500": 3, ... }`)
  - `totals_by_method jsonb` (snapshot at close: cash, transfer, pos_card)
- Update `close_shift` PG function to also store `totals_by_method` and `counted_cash_breakdown`.

**`DenominationCounter` component** (new):

- Inputs for ₦1000, 500, 200, 100, 50, 20, 10, 5 (Naira denominations).
- Auto-sums to the counted total; pushes that into the existing `counted` field.
- Mobile-friendly: 4×2 grid of large number inputs.

**`Shifts.tsx` close dialog**:

- Replace single "counted" input with `DenominationCounter`.
- Show live "Expected" vs "Counted" vs "Variance" panel.
- Show breakdown by payment method (cash / transfer / POS card) for the open shift, sourced from `sales` query for that shift.

**Z-report (printable)**:

- New `src/components/ZReport.tsx` styled like the receipt (80mm thermal).
- Sections: store header, cashier, opened/closed times, totals by payment method, # of transactions, refunds, voids, opening float, expected cash, counted cash + denomination breakdown, variance, low-stock items at close, signature line.
- "Print Z-report" button in the close dialog and on each closed shift row in the table — uses the same `printHtml` helper from `src/lib/print.ts`.
- "Download CSV" of the current shift's sales also added.

**Reports page enhancement**:

- Add an **End of Day** tab that auto-loads today's report for the logged-in cashier (or any cashier for managers) — same Z-report layout, printable.

## 4. Bug sweep + mobile QA

Items found while reading the code that I'll fix in this round:

- `Sales.tsx` print button uses `window.print()` which prints the whole page; switch to the `printHtml` iframe helper so only the receipt prints.
- `POS.tsx` "Start shift" uses `window.prompt`; replace with a small dialog that includes `DenominationCounter` for the opening float.
- `POS.tsx` cart panel: on small screens (< lg) the bottom action bar can be hidden by the keyboard; add a sticky floating "Checkout" button on mobile when items are in cart.
- Products table on mobile: switch to a stacked card layout below `sm` breakpoint (current horizontal scroll is hard to use).
- `BarcodeScanner.tsx`: add a fallback toast when `getUserMedia` is denied or unavailable (some Android in-app browsers).
- Settings: add store logo upload (re-uses `ImageUploader` against a `store-assets` bucket; logo shows on the receipt and Z-report).
- Auth: `signUp` redirect URL — verify `emailRedirectTo` is set to `${window.location.origin}/` (currently in `Auth.tsx`).
- React Query: add `enabled: !!user` guards on a few queries that fire before auth resolves, to avoid initial 401 noise in console.

Mobile QA pass on **POS, Products, Sales, Reports, Shifts, Dashboard, Settings, Auth** at 360px width. Fix any clipped controls or off-screen tables I find while testing.

---

## Files (new)

- `supabase/functions/suggest-product-image/index.ts`
- `src/components/products/ImageUploader.tsx`
- `src/components/shifts/DenominationCounter.tsx`
- `src/components/shifts/ZReport.tsx`
- `src/components/OfflineBanner.tsx`
- `supabase/migrations/<ts>_product_images_and_shift_breakdown.sql`

## Files (modified)

- `src/components/AppLayout.tsx`, `src/index.css` — colorful nav
- `src/pages/Products.tsx` — image uploader, mobile cards, thumbnails
- `src/pages/Shifts.tsx` — denomination counter, Z-report buttons
- `src/pages/POS.tsx` — better start-shift dialog, sticky mobile checkout
- `src/pages/Sales.tsx` — proper receipt-only print
- `src/pages/Settings.tsx` — store logo upload
- `src/components/pos/ProductGrid.tsx` — fallback image placeholder
- `supabase/functions/close-shift/index.ts` — accept breakdown payload

## Out of scope (deferred per your answers)

- Multi-store / multi-tenant data scoping.
- Offline checkout queue or service-worker caching of the app shell beyond what already exists for push.

If approved, I'll implement everything above and do a manual click-through of every page at mobile width before handing back.