import { useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Receipt, type ReceiptData } from "@/components/Receipt";
import { Download, Printer, X } from "lucide-react";
import { toast } from "sonner";
import { formatNaira } from "@/lib/money";
import { fmtDateTime } from "@/lib/dates";

interface Props {
  data: ReceiptData | null;
  onClose: () => void;
}

/** Escape HTML to prevent injection from product/store names. */
function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Build a fully self-contained 80mm thermal receipt HTML document. */
function buildReceiptHtml(d: ReceiptData): string {
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
  .receipt {
    width: 80mm;
    padding: 6mm 4mm;
    margin: 0 auto;
  }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .small { font-size: 11px; }
  .upper { text-transform: uppercase; }
  .muted { color: #444; }
  .name { word-break: break-word; }
  .status { text-align: center; font-weight: 700; text-transform: uppercase; margin-top: 2px; }
  .divider {
    border: none;
    border-top: 1px dashed #000;
    margin: 6px 0;
  }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-variant-numeric: tabular-nums;
  }
  .row > span:last-child { text-align: right; white-space: nowrap; }
  .item { margin-bottom: 4px; }
  .total { font-size: 14px; font-weight: 700; }
  @media print {
    html, body { width: 80mm; }
  }
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
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () {
        try { window.focus(); window.print(); } catch (e) {}
      }, 80);
    });
    window.addEventListener('afterprint', function () {
      setTimeout(function () { window.close(); }, 150);
    });
  </script>
</body>
</html>`;
}

export function ReceiptDialog({ data, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const hasAutoPrintedRef = useRef(false);

  const printReceipt = () => {
    if (!data) return;
    const html = buildReceiptHtml(data);
    const win = window.open("", "_blank", "width=380,height=640");
    if (!win) {
      toast.error("Pop-up blocked. Allow pop-ups or download the PDF instead.");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const downloadPdf = async () => {
    if (!ref.current || !data) return;
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const node = ref.current;
      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        width: node.offsetWidth,
        windowWidth: node.offsetWidth,
      });
      const imgData = canvas.toDataURL("image/png");
      const widthMm = 80;
      const heightMm = (canvas.height / canvas.width) * widthMm;
      const pdf = new jsPDF({ unit: "mm", format: [widthMm, heightMm] });
      pdf.addImage(imgData, "PNG", 0, 0, widthMm, heightMm);
      pdf.save(`receipt-${data.sale_number}.pdf`);
      toast.success("Receipt downloaded");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not generate PDF";
      toast.error(msg);
    }
  };

  // Auto-print once when a new receipt is shown.
  useEffect(() => {
    if (data && !hasAutoPrintedRef.current) {
      hasAutoPrintedRef.current = true;
      // Small delay so the dialog has a chance to mount before opening a popup.
      const t = setTimeout(() => printReceipt(), 120);
      return () => clearTimeout(t);
    }
    if (!data) {
      hasAutoPrintedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return (
    <Dialog open={!!data} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm gap-3 p-4">
        <DialogHeader className="text-left">
          <DialogTitle>Receipt</DialogTitle>
          <DialogDescription className="sr-only">
            Preview, print or download the sale receipt.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] overflow-auto rounded-md bg-muted/40 p-2">
          {data && <Receipt ref={ref} data={data} />}
        </div>
        <DialogFooter className="flex flex-col gap-2 sm:grid sm:grid-cols-3">
          <Button variant="outline" className="h-12 w-full" onClick={onClose}>
            <X className="mr-1 h-4 w-4" />
            Close
          </Button>
          <Button variant="outline" className="h-12 w-full" onClick={downloadPdf}>
            <Download className="mr-1 h-4 w-4" />
            PDF
          </Button>
          <Button className="h-12 w-full" onClick={printReceipt}>
            <Printer className="mr-1 h-4 w-4" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
