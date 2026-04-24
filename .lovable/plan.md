

## Auto-print receipt + auto-detect barcode scanner

Two small UX upgrades to the POS so cashiers don't have to tap extra buttons.

### 1. Auto-print receipt after payment

Today, after payment is confirmed the `ReceiptDialog` opens and the cashier has to tap **Print**. Change it so the print window opens automatically the moment the receipt dialog appears.

- In `src/components/pos/ReceiptDialog.tsx`, add a `useEffect` that fires once when the dialog transitions to `open === true` and a receipt is present, calling the existing `printReceipt()` helper.
- Guard with a `hasAutoPrintedRef` so it only fires once per receipt (prevents re-print on re-render or when the user closes/reopens manually).
- Reset the guard whenever the dialog closes so the next sale prints again.
- Keep the manual **Print** button as a fallback (popup blockers, reprint).
- If the popup is blocked, the existing toast already tells the cashier to use **PDF** — no change needed there.

### 2. Barcode scanner: automatic continuous detection

Today the scanner closes after the first successful read. The user wants it to keep detecting automatically.

- In `src/components/pos/BarcodeScanner.tsx`, on a successful decode: keep the camera stream alive, call `onDetected(code)`, vibrate, show a brief in-dialog "Added: <code>" confirmation, then resume scanning.
- Add a short debounce window (~1.2s) per code so the same barcode held in front of the camera doesn't add the same item dozens of times. Different codes scan immediately.
- Keep an **X / Done** button so the cashier can close when finished.
- In `src/pages/POS.tsx`, stop closing the scanner inside `handleScanned` — let the dialog stay open until the cashier dismisses it. Each detected product still adds to the cart and shows the existing toast.

### Files touched
- `src/components/pos/ReceiptDialog.tsx` — auto-print effect + ref guard
- `src/components/pos/BarcodeScanner.tsx` — continuous scanning with per-code debounce + on-screen confirmation
- `src/pages/POS.tsx` — remove auto-close of scanner after a hit

### Verification
Run a sale → confirm payment → print dialog opens automatically. Then open the scanner, scan two different barcodes back-to-back without closing it, and confirm both land in the cart.

