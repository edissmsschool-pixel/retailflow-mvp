## Goal

1. Eliminate any horizontal scrolling on small screens across the app.
2. Always display stock quantity on every product card in the POS catalog (not just for low-stock items).

## Changes

### 1. POS product card — always show stock (`src/components/pos/ProductGrid.tsx`)

Currently the card only shows `×{stock_qty}` for items that are not low and not out, and only on `sm+` (hidden on mobile). The low-stock badge shows the number in the corner; out-of-stock shows "Out".

Update the card footer so every product shows its stock count on all viewports:
- Add a small stock pill below or beside the price, e.g. `"{n} in stock"` (or `Out` when 0), visible on mobile and desktop.
- Keep color cue: destructive when `out`, warning when `low`, muted otherwise.
- Remove the duplicate corner low-stock badge OR keep it but ensure the inline label is always present.

### 2. Prevent horizontal overflow globally

- In `src/index.css`, add a safety rule on `html, body { overflow-x: hidden; max-width: 100%; }` and `#root { overflow-x: hidden; }` so no rogue child can cause page-level horizontal scroll.
- In `src/pages/POS.tsx` outer container, add `overflow-x-hidden` and ensure the fixed mobile checkout bar uses `inset-x-0` (already does) without wider children. The grid `lg:grid-cols-[1fr_400px]` is fine because it only activates at `lg`.
- Audit other pages for `min-w-[...]` / wide tables. Tables inside `overflow-x-auto` wrappers (e.g. Products desktop table) are scoped and acceptable — they scroll inside their card, not the page.

### 3. QA

- Verify at 360px viewport (current device) that no page produces horizontal scroll.
- Verify each POS product card shows the stock qty.

## Files touched

- `src/components/pos/ProductGrid.tsx` — show stock qty on every card.
- `src/index.css` — add `overflow-x: hidden` safety net on `html`, `body`, `#root`.
- `src/pages/POS.tsx` — add `overflow-x-hidden` to root container (defensive).
