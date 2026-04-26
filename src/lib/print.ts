import type { ReceiptData } from "@/components/Receipt";
import { formatNaira } from "@/lib/money";
import { fmtDateTime } from "@/lib/dates";

/** Escape HTML to prevent injection from user-controlled fields. */
function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Build a fully self-contained 80mm thermal receipt HTML document. */
export function buildReceiptHtml(d: ReceiptData): string {
  const itemsHtml = d.items
    .map((it) => {
      const discount =
        it.line_discount_kobo > 0
          ? `<div class="row muted"><span>&nbsp;&nbsp;discount</span><span>-${esc(formatNaira(it.line_discount_kobo))}</span></div>`
          : "";
      return `
        <div class="item">
          <div class="name">${esc(it.product_name)}</div>
          <div class="row"><span>${esc(it.quantity)} × ${esc(formatNaira(it.unit_price_kobo))}</span><span>${esc(formatNaira(it.line_total_kobo))}</span></div>
          ${discount}
        </div>`;
    })
    .join("");

  const statusBadge =
    d.status && d.status !== "completed"
      ? `<div class="status">[${esc(d.status.replace("_", " "))}]</div>`
      : "";

  const discountRow =
    d.discount_kobo > 0
      ? `<div class="row"><span>Discount</span><span>-${esc(formatNaira(d.discount_kobo))}</span></div>`
      : "";

  const changeRow =
    d.change_kobo > 0
      ? `<div class="row"><span>Change</span><span>${esc(formatNaira(d.change_kobo))}</span></div>`
      : "";

  const footer = d.receipt_footer
    ? `<div class="center small">${esc(d.receipt_footer)}</div>`
    : "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Receipt #${esc(d.sale_number)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #000;
    font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, "Courier New", monospace;
    font-size: 12px;
    line-height: 1.35;
  }
  .receipt { width: 80mm; padding: 6mm 4mm; margin: 0 auto; }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .small { font-size: 11px; }
  .upper { text-transform: uppercase; }
  .muted { color: #444; }
  .name { word-break: break-word; }
  .status { text-align: center; font-weight: 700; text-transform: uppercase; margin-top: 2px; }
  .divider { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; font-variant-numeric: tabular-nums; }
  .row > span:last-child { text-align: right; white-space: nowrap; }
  .item { margin-bottom: 4px; }
  .total { font-size: 14px; font-weight: 700; }
  @media print { html, body { width: 80mm; } }
</style>
</head>
<body>
  <div class="receipt">
    <div class="center">
      <div class="bold upper" style="font-size:13px;">${esc(d.store_name)}</div>
      ${d.store_address ? `<div class="small">${esc(d.store_address)}</div>` : ""}
      ${d.store_phone ? `<div class="small">Tel: ${esc(d.store_phone)}</div>` : ""}
    </div>
    <hr class="divider" />
    <div class="row"><span>Sale #</span><span>${esc(d.sale_number)}</span></div>
    <div class="row"><span>Date</span><span>${esc(fmtDateTime(d.created_at))}</span></div>
    <div class="row"><span>Cashier</span><span>${esc(d.cashier_name)}</span></div>
    ${statusBadge}
    <hr class="divider" />
    ${itemsHtml}
    <hr class="divider" />
    <div class="row"><span>Subtotal</span><span>${esc(formatNaira(d.subtotal_kobo))}</span></div>
    ${discountRow}
    <div class="row total"><span>TOTAL</span><span>${esc(formatNaira(d.total_kobo))}</span></div>
    <div class="row"><span>Payment (${esc(d.payment_method.replace("_", " "))})</span><span>${esc(formatNaira(d.amount_tendered_kobo))}</span></div>
    ${changeRow}
    <hr class="divider" />
    ${footer}
    <div class="center small" style="margin-top:8px;">Thank you for shopping with us!</div>
  </div>
</body>
</html>`;
}

/**
 * Print a receipt silently using a hidden iframe — no popup window.
 * On Chrome with `--kiosk-printing`, this prints directly to the default printer.
 * Otherwise the OS print dialog appears with the default printer pre-selected.
 */
export function printReceiptSilent(data: ReceiptData): void {
  const html = buildReceiptHtml(data);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const cleanup = () => {
    // Delay so the print job has time to spool before tearing down the document.
    setTimeout(() => {
      try {
        iframe.remove();
      } catch {
        /* noop */
      }
    }, 1000);
  };

  const triggerPrint = () => {
    const win = iframe.contentWindow;
    if (!win) {
      cleanup();
      return;
    }
    try {
      win.focus();
      win.addEventListener("afterprint", cleanup, { once: true });
      win.print();
    } catch {
      cleanup();
    }
    // Safety net: if afterprint never fires (e.g. user cancels), still clean up.
    setTimeout(cleanup, 60_000);
  };

  // Prefer srcdoc — works without cross-origin issues.
  iframe.onload = () => {
    // Give the document one tick to lay out.
    setTimeout(triggerPrint, 50);
  };
  iframe.srcdoc = html;
}
