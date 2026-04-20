import { useState } from "react";
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
import { formatNaira, parseKoboInput } from "@/lib/money";
import { fmtDateTime } from "@/lib/dates";
import { toast } from "sonner";
import { Lock } from "lucide-react";

interface Shift {
  id: string; cashier_id: string; opening_float_kobo: number; opened_at: string;
  closed_at: string | null; expected_cash_kobo: number | null; counted_cash_kobo: number | null;
  variance_kobo: number | null; status: string; notes: string | null;
  profiles: { full_name: string } | null;
}

export default function Shifts() {
  const { user, isManagerOrAdmin } = useAuth();
  const qc = useQueryClient();
  const [closing, setClosing] = useState<Shift | null>(null);
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");

  const shifts = useQuery({
    queryKey: ["shifts-list", isManagerOrAdmin, user?.id],
    queryFn: async () => {
      const q = supabase.from("shifts").select("*, profiles:cashier_id(full_name)").order("opened_at", { ascending: false }).limit(100);
      const { data, error } = isManagerOrAdmin ? await q : await q.eq("cashier_id", user!.id);
      if (error) throw error;
      return data as unknown as Shift[];
    },
  });

  const closeShift = async () => {
    if (!closing) return;
    const { error } = await supabase.functions.invoke("close-shift", {
      body: { shift_id: closing.id, counted_cash_kobo: parseKoboInput(counted), notes },
    });
    if (error) return toast.error(error.message);
    toast.success("Shift closed");
    setClosing(null); setCounted(""); setNotes("");
    qc.invalidateQueries({ queryKey: ["shifts-list"] });
    qc.invalidateQueries({ queryKey: ["open-shift"] });
  };

  return (
    <div className="container py-6">
      <PageHeader title="Shifts" description="End-of-day cash close, variance log." />
      <Card className="shadow-card">
        <CardContent className="p-4">
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
                  <TableHead></TableHead>
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
                        <Button size="sm" onClick={() => setClosing(s)}><Lock className="mr-2 h-4 w-4" />Close</Button>
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
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Close shift</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Count the cash in the drawer and enter the total.</div>
            <div className="space-y-1.5">
              <Label>Counted cash (₦)</Label>
              <Input inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. customer overpaid ₦200" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClosing(null)}>Cancel</Button>
            <Button onClick={closeShift}>Close shift</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
