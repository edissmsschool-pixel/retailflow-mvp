
## Fix receipt printing

The Print button currently calls `window.print()` from inside the Lovable preview iframe. Mobile browsers and sandboxed iframes block or ignore that call, so nothing happens. The PDF path also occasionally fails silently because errors from `html2canvas` are swallowed.

### What I'll change

**1. Replace `window.print()` with a dedicated print window**
In `src/components/pos/ReceiptDialog.tsx`, build a self-contained HTML document containing just the receipt markup + inlined 80mm thermal CSS, open it via `window.open('', '_blank')`, write the HTML, then call `print()` on that new window once it loads. This works on desktop browsers, Android Chrome, iOS Safari, and inside the Lovable preview because the new tab is no longer sandboxed by the iframe. Falls back gracefully if popups are blocked (toast + offer PDF).

**2. Make the print HTML self-sufficient**
Embed the receipt as plain HTML/CSS (no Tailwind dependency, no theme tokens) so the print window renders identically on any device and any printer driver. Includes:
- 80mm page size + zero margins via `@page`
- Monospace font, dashed dividers, right-aligned tabular numbers
- Auto-trigger `print()` then `close()` on the new window after the dialog is dismissed

**3. Harden PDF download**
- Surface real error messages instead of a generic toast
- Force white background and explicit pixel width on the cloned node so html2canvas always has a stable layout
- Lazy-load `html2canvas`/`jspdf` only on click (already the case)

**4. Fix the dialog accessibility warning**
Add a `DialogDescription` (visually hidden) to the receipt dialog and the held-sales dialog to clear the Radix `aria-describedby` warning seen in the console.

**5. Add a "Print" affordance that's reachable on mobile**
The current 3-button footer fits, but on a 360px screen it's tight. Stack buttons vertically below `sm` breakpoint so each gets full width and the 48px touch target is preserved.

### Files touched
- `src/components/pos/ReceiptDialog.tsx` — new print-window helper, better error handling, responsive footer, a11y description
- `src/pages/POS.tsx` — add `DialogDescription` to held-sales dialog (small a11y cleanup)

### Verification
After the change I'll open the preview at mobile width, run a sale, then click **Print** and **PDF** from the receipt dialog to confirm both work end-to-end.
