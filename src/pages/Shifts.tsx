import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { formatNaira } from "@/lib/money";
import { fmtDateTime } from "@/lib/dates";
import { toast } from "sonner";
import { Lock, Printer } from "lucide-react";
import { DenominationCounter, type DenominationMap } from "@/components/shifts/DenominationCounter";
import { printZReport, type ZReportData } from "@/components/shifts/ZReport";

interface Shift {
  id: string; cashier_id: string; opening_float_kobo: number; opened_at: string;
  closed_at: string | null; expected_cash_kobo: number | null; counted_cash_kobo: number | null;
  variance_kobo: number | null; status: string; notes: string | null;
  totals_by_method: Record<string, number> | null;
  counted_cash_breakdown: Record<string, number> | null;
  profiles: { full_name: string } | null;
}

export default function Shifts() {
  const { user, isManagerOrAdmin } = useAuth();
  const qc = useQueryClient();
  const [closing, setClosing] = useState<Shift | null>(null);
  const [breakdown, setBreakdown] = useState<DenominationMap>({});
  const [countedKobo, setCountedKobo] = useState(0);
  const [notes, setNotes] = useState("");

  const shifts = useQuery({
    queryKey: ["shifts-list", isManagerOrAdmin, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const q = supabase.from("shifts").select("*, profiles:cashier_id(full_name)").order("opened_at", { ascending: false }).limit(100);
      const { data, error } = isManagerOrAdmin ? await q : await q.eq("cashier_id", user!.id);
      if (error) throw error;
      return data as unknown as Shift[];
    },
  });

  // Live totals for the open shift being closed (sales by payment method)
  const liveSales = useQuery({
    queryKey: ["shift-live-sales", closing?.id],
    enabled: !!closing && closing.status === "open",
    queryFn: async () => {
      const { data } = await supabase.from("sales")
        .select("total_kobo, payment_method, status")
        .eq("shift_id", closing!.id)
        .neq("status", "voided");
      return data ?? [];
    },
  });

  const liveTotals = useMemo(() => {
    const m: Record<string, number> = {};
    (liveSales.data ?? []).forEach((s) => {
      m[s.payment_method] = (m[s.payment_method] ?? 0) + s.total_kobo;
    });
    return m;
  }, [liveSales.data]);

  const liveExpectedCash = (liveTotals["cash"] ?? 0) + (closing?.opening_float_kobo ?? 0);
  const variance = countedKobo - liveExpectedCash;

  const startClose = (s: Shift) => {
    setClosing(s);
    setBreakdown({});
    setCountedKobo(0);
    setNotes("");
  };

  const closeShift = async () => {
    if (!closing) return;
    const { error } = await supabase.functions.invoke("close-shift", {
      body: {
        shift_id: closing.id,
        counted_cash_kobo: countedKobo,
        counted_breakdown: breakdown,
        notes,
      },
    });
    if (error) return toast.error(error.message);

    // Build & print Z-report
    const { data: settings } = await supabase.from("store_settings").select("*").eq("id", 1).single();
    const txnCount = (liveSales.data ?? []).length;
    const z: ZReportData = {
      store_name: settings?.store_name ?? "Store",
      store_address: settings?.address,
      store_phone: settings?.phone,
      cashier_name: closing.profiles?.full_name ?? "",
      shift_id: closing.id,
      opened_at: closing.opened_at,
      closed_at: new Date().toISOString(),
      opening_float_kobo: closing.opening_float_kobo,
      totals_by_method: liveTotals,
      txn_count: txnCount,
      refunds_kobo: 0,
      voids_count: 0,
      expected_cash_kobo: liveExpectedCash,
      counted_cash_kobo: countedKobo,
      variance_kobo: variance,
      counted_breakdown: breakdown,
      notes,
    };
    printZReport(z);

    toast.success("Shift closed — printing Z-report");
    setClosing(null);
    qc.invalidateQueries({ queryKey: ["shifts-list"] });
    qc.invalidateQueries({ queryKey: ["open-shift"] });
  };

  const reprintZ = async (s: Shift) => {
    const { data: settings } = await supabase.from("store_settings").select("*").eq("id", 1).single();
    const { data: salesData } = await supabase.from("sales")
      .select("total_kobo, payment_method, status").eq("shift_id", s.id).neq("status", "voided");
    const txnCount = (salesData ?? []).length;
    const totals = s.totals_by_method ?? {};
    const z: ZReportData = {
      store_name: settings?.store_name ?? "Store",
      store_address: settings?.address,
      store_phone: settings?.phone,
      cashier_name: s.profiles?.full_name ?? "",
      shift_id: s.id,
      opened_at: s.opened_at,
      closed_at: s.closed_at,
      opening_float_kobo: s.opening_float_kobo,
      totals_by_method: totals,
      txn_count: txnCount,
      refunds_kobo: 0,
      voids_count: 0,
      expected_cash_kobo: s.expected_cash_kobo ?? 0,
      counted_cash_kobo: s.counted_cash_kobo ?? 0,
      variance_kobo: s.variance_kobo ?? 0,
      counted_breakdown: s.counted_cash_breakdown,
      notes: s.notes,
    };
    printZReport(z);
  };

  return (
    <div className="container px-3 py-4 sm:px-6 sm:py-6">
      <PageHeader title="Shifts" description="Cash reconciliation, end-of-day Z-reports and variance log." />
      <Card className="shadow-card">
        <CardContent className="p-3 sm:p-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cashier</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Closed</TableHead>
                  <TableHead className="text-right">Float</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Counted</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.data?.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.profiles?.full_name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{fmtDateTime(s.opened_at)}</TableCell>
                    <TableCell className="text-sm">{s.closed_at ? fmtDateTime(s.closed_at) : <Badge variant="secondary">Open</Badge>}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNaira(s.opening_float_kobo)}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.expected_cash_kobo != null ? formatNaira(s.expected_cash_kobo) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.counted_cash_kobo != null ? formatNaira(s.counted_cash_kobo) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.variance_kobo != null ? (
                        <span className={s.variance_kobo === 0 ? "" : s.variance_kobo > 0 ? "text-success" : "text-destructive"}>
                          {s.variance_kobo > 0 ? "+" : ""}{formatNaira(s.variance_kobo)}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.status === "open" && (s.cashier_id === user?.id || isManagerOrAdmin) && (
                        <Button size="sm" onClick={() => startClose(s)}><Lock className="mr-1.5 h-4 w-4" />Close</Button>
                      )}
                      {s.status === "closed" && (
                        <Button size="sm" variant="outline" onClick={() => reprintZ(s)}>
                          <Printer className="mr-1.5 h-4 w-4" />Z-report
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {shifts.data?.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No shifts yet. Start one from the POS.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!closing} onOpenChange={(o) => !o && setClosing(null)}>
        <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>Close shift &amp; reconcile cash</DialogTitle></DialogHeader>

          <div className="space-y-4">
            {/* Live totals by method */}
            <div className="rounded-xl border bg-muted/40 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sales this shift</div>
              <div className="space-y-1 text-sm">
                {Object.keys(liveTotals).length === 0 && <div className="text-muted-foreground">No sales yet</div>}
                {Object.entries(liveTotals).map(([k, v]) => (
                  <div key={k} className="flex justify-between tabular-nums">
                    <span className="capitalize">{k.replace("_", " ")}</span>
                    <span>{formatNaira(v)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Count cash in drawer (denominations)</Label>
              <DenominationCounter
                value={breakdown}
                onChange={(b, total) => { setBreakdown(b); setCountedKobo(total); }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-xl border p-3 text-sm">
              <Stat label="Expected" value={formatNaira(liveExpectedCash)} />
              <Stat label="Counted" value={formatNaira(countedKobo)} />
              <Stat
                label="Variance"
                value={`${variance > 0 ? "+" : ""}${formatNaira(variance)}`}
                tone={variance === 0 ? "default" : variance > 0 ? "success" : "destructive"}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. customer overpaid ₦200" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setClosing(null)}>Cancel</Button>
            <Button onClick={closeShift}><Printer className="mr-1.5 h-4 w-4" />Close &amp; print Z-report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "destructive" }) {
  return (
    <div className="text-center">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-display text-base font-bold tabular-nums ${tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}
