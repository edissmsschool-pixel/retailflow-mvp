import { formatNaira } from "@/lib/money";
import { fmtDateTime } from "@/lib/dates";

export interface ZReportData {
  store_name: string;
  store_address?: string | null;
  store_phone?: string | null;
  cashier_name: string;
  shift_id: string;
  opened_at: string;
  closed_at?: string | null;
  opening_float_kobo: number;
  totals_by_method: Record<string, number>; // kobo
  txn_count: number;
  refunds_kobo: number;
  voids_count: number;
  expected_cash_kobo: number;
  counted_cash_kobo: number;
  variance_kobo: number;
  counted_breakdown?: Record<string, number> | null;
  notes?: string | null;
}

const NAIRA_DENOMS = [1000, 500, 200, 100, 50, 20, 10, 5];

function esc(s: unknown) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildZReportHtml(d: ZReportData): string {
  const methods = Object.entries(d.totals_by_method ?? {})
    .map(([k, v]) => `<div class="row"><span>${esc(k.replace("_", " "))}</span><span>${esc(formatNaira(v))}</span></div>`)
    .join("");
  const totalSales = Object.values(d.totals_by_method ?? {}).reduce((a, b) => a + b, 0);
  const breakdown = d.counted_breakdown
    ? NAIRA_DENOMS
        .filter((n) => (d.counted_breakdown![String(n)] ?? 0) > 0)
        .map((n) => {
          const c = d.counted_breakdown![String(n)] ?? 0;
          return `<div class="row"><span>₦${n} × ${c}</span><span>${esc(formatNaira(n * 100 * c))}</span></div>`;
        })
        .join("")
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"/>
<title>Z Report</title>
<style>
@page { size: 80mm auto; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #000;
  font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  font-size: 12px; line-height: 1.4; }
.r { width: 80mm; padding: 6mm 4mm; }
.c { text-align: center; }
.b { font-weight: 700; }
.upper { text-transform: uppercase; }
.row { display: flex; justify-content: space-between; gap: 8px; font-variant-numeric: tabular-nums; }
.row > span:last-child { text-align: right; white-space: nowrap; }
hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
.title { font-weight: 700; text-transform: uppercase; margin-top: 6px; }
.total { font-size: 14px; font-weight: 700; }
.sig { margin-top: 14px; border-top: 1px solid #000; padding-top: 4px; }
</style></head><body><div class="r">
  <div class="c"><div class="b upper" style="font-size:13px;">${esc(d.store_name)}</div>
    ${d.store_address ? `<div>${esc(d.store_address)}</div>` : ""}
    ${d.store_phone ? `<div>Tel: ${esc(d.store_phone)}</div>` : ""}
    <div class="b" style="margin-top:4px;">Z REPORT — END OF SHIFT</div>
  </div>
  <hr/>
  <div class="row"><span>Cashier</span><span>${esc(d.cashier_name)}</span></div>
  <div class="row"><span>Shift</span><span>#${esc(d.shift_id.slice(0, 8))}</span></div>
  <div class="row"><span>Opened</span><span>${esc(fmtDateTime(d.opened_at))}</span></div>
  ${d.closed_at ? `<div class="row"><span>Closed</span><span>${esc(fmtDateTime(d.closed_at))}</span></div>` : ""}
  <hr/>
  <div class="title">Sales by payment</div>
  ${methods || `<div class="row"><span>(no sales)</span><span>—</span></div>`}
  <div class="row total"><span>TOTAL</span><span>${esc(formatNaira(totalSales))}</span></div>
  <div class="row"><span>Transactions</span><span>${esc(d.txn_count)}</span></div>
  <div class="row"><span>Refunds</span><span>-${esc(formatNaira(d.refunds_kobo))}</span></div>
  <div class="row"><span>Voids</span><span>${esc(d.voids_count)}</span></div>
  <hr/>
  <div class="title">Cash reconciliation</div>
  <div class="row"><span>Opening float</span><span>${esc(formatNaira(d.opening_float_kobo))}</span></div>
  <div class="row"><span>Expected cash</span><span>${esc(formatNaira(d.expected_cash_kobo))}</span></div>
  <div class="row"><span>Counted cash</span><span>${esc(formatNaira(d.counted_cash_kobo))}</span></div>
  <div class="row b"><span>Variance</span><span>${d.variance_kobo > 0 ? "+" : ""}${esc(formatNaira(d.variance_kobo))}</span></div>
  ${breakdown ? `<hr/><div class="title">Denomination breakdown</div>${breakdown}` : ""}
  ${d.notes ? `<hr/><div><b>Notes:</b> ${esc(d.notes)}</div>` : ""}
  <div class="sig">Cashier signature</div>
  <div class="sig">Manager signature</div>
  <div class="c" style="margin-top:8px; font-size:10px;">Printed ${esc(fmtDateTime(new Date()))}</div>
</div></body></html>`;
}

export function printZReport(data: ZReportData) {
  const html = buildZReportHtml(data);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);
  const cleanup = () => setTimeout(() => { try { iframe.remove(); } catch { /* noop */ } }, 1000);
  iframe.onload = () => setTimeout(() => {
    const win = iframe.contentWindow;
    if (!win) return cleanup();
    try {
      win.focus();
      win.addEventListener("afterprint", cleanup, { once: true });
      win.print();
    } catch { cleanup(); }
    setTimeout(cleanup, 60_000);
  }, 50);
  iframe.srcdoc = html;
}
