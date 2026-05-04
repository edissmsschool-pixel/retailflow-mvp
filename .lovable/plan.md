## Mobile screen analysis (360px viewport, POS page)

Reviewing the screenshot:

**Working well**
- No horizontal page scroll. Header brand truncates cleanly.
- Stock pill renders on every card ("24 in stock", "6 in stock").
- Sticky cart bar respects safe-area inset above bottom nav.
- Category chips scroll horizontally without breaking layout.

**Issues**
1. **Only 2 products visible above the fold.** The product card image is `w-24` (96px) and right-side padding is `p-3`, making each row ~110px tall. The header stack (title + buttons + search + chips) consumes ~280px before any product appears.
2. **Redundant numeric badge.** Low-stock items show a corner number badge AND the inline "N in stock" pill — duplication.
3. **Cart bar is tall** (`h-14` button + `p-3` wrapper ≈ 80px) and stacks with the 64px bottom nav, eating ~22% of viewport height.
4. **Price/stock row gap** is wide; on narrow screens the `+` button can wrap awkwardly.
5. **POS title row** ("Point of Sale" + Start-shift + Held) is non-essential vertical real estate on mobile.

## Proposed changes

### `src/components/pos/ProductGrid.tsx`
- Reduce mobile thumbnail to `w-20` (80px), padding to `p-2.5`.
- Drop card min-height to `4.5rem` on mobile.
- Remove the duplicate corner low-stock number badge (keep inline pill only, color-coded: warning when low, destructive when out).
- Tighten the price/stock row with `gap-x-2 gap-y-1` and place the `+` button with `ml-auto`.
- Result: ~3 products visible above the fold instead of 2.

### `src/pages/POS.tsx`
- Hide the "Point of Sale" CardTitle on mobile (`hidden sm:block`); keep Start-shift / Held buttons.
- Reduce mobile sticky cart bar wrapper from `p-3` to `px-3 py-2` and button from `h-14` to `h-12`.
- Reduce search input height from `h-12` to `h-11` on mobile (keep `h-12` on `sm+`).
- Trim category chip padding from `px-4 py-2` to `px-3 py-1.5` on mobile.

### Files touched
- `src/components/pos/ProductGrid.tsx`
- `src/pages/POS.tsx`

Net effect: one extra product visible above the fold, less chrome, same touch-target comfort (all interactive elements remain ≥40px tall).
