import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatNaira } from "@/lib/money";
import { fmtDateTime, startOfDayISO, endOfDayISO, daysAgoISO } from "@/lib/dates";
import { Receipt, type ReceiptData } from "@/components/Receipt";
import { useAuth } from "@/contexts/AuthContext";
import { fetchReceiptStore } from "@/lib/receiptStore";
import { toast } from "sonner";
import { Eye, Printer, RotateCcw, XCircle, Download } from "lucide-react";
import { downloadCsv } from "@/lib/csv";

type SaleRow = {
  id: string; sale_number: number; total_kobo: number; payment_method: string;
  status: string; created_at: string; cashier_id: string;
  profiles: { full_name: string } | null;
};

export default function Sales() {
  const { user, isManagerOrAdmin } = useAuth();
  const qc = useQueryClient();
  const [range, setRange] = useState<"today" | "7d" | "30d" | "all">("today");
  const [method, setMethod] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundQuantities, setRefundQuantities] = useState<Record<string, number>>({});

  const sales = useQuery({
    queryKey: ["sales", range, method, status, user?.id],
    queryFn: async () => {
      let q = supabase.from("sales").select("id, sale_number, total_kobo, payment_method, status, created_at, cashier_id, profiles:cashier_id(full_name)").order("created_at", { ascending: false }).limit(500);
      if (range === "today") q = q.gte("created_at", startOfDayISO()).lte("created_at", endOfDayISO());
      else if (range === "7d") q = q.gte("created_at", daysAgoISO(6));
      else if (range === "30d") q = q.gte("created_at", daysAgoISO(29));
      if (method !== "all") q = q.eq("payment_method", method as "cash" | "transfer" | "pos_card");
      if (status !== "all") q = q.eq("status", status as "completed" | "refunded" | "partially_refunded" | "voided");
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as SaleRow[];
    },
  });

  const detail = useQuery({
    queryKey: ["sale-detail", open],
    enabled: !!open,
    queryFn: async () => {
      const { data: sale } = await supabase.from("sales").select("*, profiles:cashier_id(full_name)").eq("id", open!).single();
      const { data: items } = await supabase.from("sale_items").select("*").eq("sale_id", open!).order("created_at");
      const settings = await fetchReceiptStore();
      return { sale, items: items ?? [], settings };
    },
  });


  const receiptData: ReceiptData | null = useMemo(() => {
    if (!detail.data?.sale || !detail.data.settings) return null;
    const s = detail.data.sale;
    const cashierName = (s as unknown as { profiles?: { full_name?: string } }).profiles?.full_name || "";
    return {
      store_name: detail.data.settings.store_name,
      store_address: detail.data.settings.address,
      store_phone: detail.data.settings.phone,
      receipt_footer: detail.data.settings.receipt_footer,
      store_logo_url: detail.data.settings.logo_url,
      sale_number: s.sale_number,
      cashier_name: cashierName,
      created_at: s.created_at,
      items: detail.data.items.map((it) => ({
        product_name: it.product_name, sku: it.sku, quantity: it.quantity,
        unit_price_kobo: it.unit_price_kobo, line_discount_kobo: it.line_discount_kobo, line_total_kobo: it.line_total_kobo,
      })),
      subtotal_kobo: s.subtotal_kobo, discount_kobo: s.discount_kobo, total_kobo: s.total_kobo,
      payment_method: s.payment_method, amount_tendered_kobo: s.amount_tendered_kobo, change_kobo: s.change_kobo,
      status: s.status,
    };
  }, [detail.data]);

  const doRefund = async () => {
    if (!open) return;
    const items = Object.entries(refundQuantities)
      .filter(([, q]) => q > 0)
      .map(([sale_item_id, quantity]) => ({ sale_item_id, quantity }));
    if (!items.length) return toast.error("Select quantity to refund");
    const { error } = await supabase.functions.invoke("refund-sale", { body: { sale_id: open, items, reason: "Customer refund" } });
    if (error) return toast.error(error.message);
    toast.success("Refund processed");
    setRefundOpen(false); setRefundQuantities({});
    qc.invalidateQueries({ queryKey: ["sales"] });
    qc.invalidateQueries({ queryKey: ["sale-detail"] });
  };

  const doVoid = async () => {
    if (!open) return;
    if (!confirm("Void this entire sale and restock all items?")) return;
    const { error } = await supabase.functions.invoke("void-sale", { body: { sale_id: open, reason: "Manager void" } });
    if (error) return toast.error(error.message);
    toast.success("Sale voided");
    qc.invalidateQueries({ queryKey: ["sales"] });
    qc.invalidateQueries({ queryKey: ["sale-detail"] });
  };

  const exportCsv = () => {
    const rows = (sales.data ?? []).map((s) => ({
      sale_number: s.sale_number,
      date: fmtDateTime(s.created_at),
      cashier: s.profiles?.full_name ?? "",
      payment: s.payment_method,
      status: s.status,
      total_naira: (s.total_kobo / 100).toFixed(2),
    }));
    downloadCsv(rows, `sales_${range}.csv`);
  };

  return (
    <div className="container px-3 py-4 sm:px-6 sm:py-6">
      <PageHeader title="Sales History" description="Review, reprint, refund or void past transactions."
        actions={<Button variant="outline" className="w-full sm:w-auto" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Export CSV</Button>} />

      <Card className="shadow-card">
        <CardContent className="space-y-4 p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
              <SelectTrigger className="h-10 sm:w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="h-10 sm:w-40"><SelectValue placeholder="Payment" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All payment</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
                <SelectItem value="pos_card">POS card</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="col-span-2 h-10 sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="partially_refunded">Partially refunded</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
                <SelectItem value="voided">Voided</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {sales.data?.map((s) => (
              <button
                key={s.id}
                onClick={() => { setOpen(s.id); setRefundQuantities({}); }}
                className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card p-3 text-left shadow-sm active:scale-[0.99]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span className="font-mono">#{s.sale_number}</span>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {fmtDateTime(s.created_at)} • {s.profiles?.full_name ?? "—"}
                  </div>
                  <div className="mt-0.5 text-xs capitalize text-muted-foreground">
                    {s.payment_method.replace("_", " ")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-base font-bold tabular-nums">{formatNaira(s.total_kobo)}</div>
                </div>
              </button>
            ))}
            {sales.data?.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">No sales found.</div>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Cashier</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.data?.map((s) => (
                  <TableRow key={s.id} className="cursor-pointer" onClick={() => { setOpen(s.id); setRefundQuantities({}); }}>
                    <TableCell className="font-mono">{s.sale_number}</TableCell>
                    <TableCell className="text-sm">{fmtDateTime(s.created_at)}</TableCell>
                    <TableCell className="text-sm">{s.profiles?.full_name ?? "—"}</TableCell>
                    <TableCell className="text-sm capitalize">{s.payment_method.replace("_", " ")}</TableCell>
                    <TableCell><StatusBadge status={s.status} /></TableCell>
                    <TableCell className="text-right tabular-nums">{formatNaira(s.total_kobo)}</TableCell>
                    <TableCell className="text-right"><Eye className="h-4 w-4 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))}
                {sales.data?.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No sales found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto">
          <DialogHeader><DialogTitle>Sale #{detail.data?.sale?.sale_number}</DialogTitle></DialogHeader>
          {receiptData && <Receipt data={receiptData} />}
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => receiptData && import("@/lib/print").then((m) => m.printReceiptSilent(receiptData))}><Printer className="mr-2 h-4 w-4" />Print</Button>
            {isManagerOrAdmin && detail.data?.sale && detail.data.sale.status !== "voided" && detail.data.sale.status !== "refunded" && (
              <>
                <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setRefundOpen(true)}><RotateCcw className="mr-2 h-4 w-4" />Refund</Button>
                <Button variant="destructive" className="flex-1 sm:flex-none" onClick={doVoid}><XCircle className="mr-2 h-4 w-4" />Void</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto">
          <DialogHeader><DialogTitle>Refund items</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {detail.data?.items.map((it) => {
              const remaining = it.quantity - it.refunded_qty;
              return (
                <div key={it.id} className="flex items-center justify-between rounded-md border p-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{it.product_name}</div>
                    <div className="text-xs text-muted-foreground">Refundable: {remaining} of {it.quantity}</div>
                  </div>
                  <Input type="number" min={0} max={remaining} className="h-8 w-20" disabled={remaining === 0}
                    value={refundQuantities[it.id] ?? 0}
                    onChange={(e) => setRefundQuantities({ ...refundQuantities, [it.id]: Math.max(0, Math.min(remaining, parseInt(e.target.value) || 0)) })} />
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)}>Cancel</Button>
            <Button onClick={doRefund}>Process refund</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    completed: { label: "Completed", cls: "bg-success/15 text-success border-success/30" },
    refunded: { label: "Refunded", cls: "bg-destructive/10 text-destructive border-destructive/30" },
    partially_refunded: { label: "Part. refunded", cls: "bg-warning/20 text-warning-foreground border-warning/40" },
    voided: { label: "Voided", cls: "bg-muted text-muted-foreground border-border" },
  };
  const m = map[status] ?? { label: status, cls: "" };
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}
