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
import { printReceiptSilent } from "@/lib/print";

interface Props {
  data: ReceiptData | null;
  onClose: () => void;
}

export function ReceiptDialog({ data, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const hasAutoPrintedRef = useRef(false);

  const printReceipt = () => {
    if (!data) return;
    try {
      printReceiptSilent(data);
    } catch {
      toast.error("Could not start print");
    }
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

  // Auto-print once when a new receipt is shown — uses hidden iframe (no popup).
  useEffect(() => {
    if (data && !hasAutoPrintedRef.current) {
      hasAutoPrintedRef.current = true;
      const t = setTimeout(() => printReceipt(), 80);
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
