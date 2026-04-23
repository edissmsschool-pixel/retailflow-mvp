import { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Receipt, type ReceiptData } from "@/components/Receipt";
import { Download, Printer, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  data: ReceiptData | null;
  onClose: () => void;
}

export function ReceiptDialog({ data, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const downloadPdf = async () => {
    if (!ref.current || !data) return;
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(ref.current, { scale: 2, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      // 80mm wide receipt, height proportional
      const widthMm = 80;
      const heightMm = (canvas.height / canvas.width) * widthMm;
      const pdf = new jsPDF({ unit: "mm", format: [widthMm, heightMm] });
      pdf.addImage(imgData, "PNG", 0, 0, widthMm, heightMm);
      pdf.save(`receipt-${data.sale_number}.pdf`);
      toast.success("Receipt downloaded");
    } catch {
      toast.error("Could not generate PDF");
    }
  };

  return (
    <Dialog open={!!data} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm gap-3 p-4">
        <DialogHeader className="text-left">
          <DialogTitle>Receipt</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto rounded-md bg-muted/40 p-2">
          {data && <Receipt ref={ref} data={data} />}
        </div>
        <DialogFooter className="grid grid-cols-3 gap-2 sm:grid-cols-3">
          <Button variant="outline" className="h-11" onClick={onClose}>
            <X className="mr-1 h-4 w-4" />
            Close
          </Button>
          <Button variant="outline" className="h-11" onClick={downloadPdf}>
            <Download className="mr-1 h-4 w-4" />
            PDF
          </Button>
          <Button className="h-11" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
