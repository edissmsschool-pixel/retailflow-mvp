import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNaira, nairaToKobo } from "@/lib/money";
import { Banknote, CreditCard, Landmark, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type PaymentMethod = "cash" | "transfer" | "pos_card";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  totalKobo: number;
  busy: boolean;
  onConfirm: (method: PaymentMethod, tenderedKobo: number) => void;
}

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

export function PaymentDialog({ open, onOpenChange, totalKobo, busy, onConfirm }: Props) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [tenderedStr, setTenderedStr] = useState("");

  useEffect(() => {
    if (open) {
      setMethod("cash");
      setTenderedStr("");
    }
  }, [open]);

  const tenderedKobo = method === "cash" ? nairaToKobo(tenderedStr || "0") : totalKobo;
  const changeKobo = Math.max(0, tenderedKobo - totalKobo);
  const shortKobo = Math.max(0, totalKobo - tenderedKobo);
  const canConfirm = method !== "cash" || tenderedKobo >= totalKobo;

  const methods: { key: PaymentMethod; label: string; icon: typeof Banknote }[] = [
    { key: "cash", label: "Cash", icon: Banknote },
    { key: "pos_card", label: "POS Card", icon: CreditCard },
    { key: "transfer", label: "Transfer", icon: Landmark },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Take Payment</DialogTitle>
        </DialogHeader>

        <div className="rounded-2xl bg-gradient-to-br from-primary to-primary-glow p-5 text-primary-foreground shadow-elevated">
          <div className="text-xs uppercase tracking-wide opacity-80">Amount due</div>
          <div className="mt-1 font-display text-3xl font-bold tabular-nums">{formatNaira(totalKobo)}</div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {methods.map((m) => {
            const Icon = m.icon;
            const active = method === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setMethod(m.key)}
                className={cn(
                  "flex min-h-[5rem] flex-col items-center justify-center gap-1 rounded-xl border-2 p-3 text-sm font-medium transition active:scale-[0.97]",
                  active
                    ? "border-primary bg-primary/10 text-primary shadow-card"
                    : "border-border bg-card hover:border-primary/40",
                )}
              >
                <Icon className="h-5 w-5" />
                {m.label}
              </button>
            );
          })}
        </div>

        {method === "cash" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Amount received (₦)</label>
              <Input
                value={tenderedStr}
                onChange={(e) => setTenderedStr(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                autoFocus
                className="h-12 text-lg font-semibold tabular-nums"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => setTenderedStr((totalKobo / 100).toFixed(2))}
              >
                Exact
              </Button>
              {QUICK_AMOUNTS.map((amt) => (
                <Button
                  key={amt}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 tabular-nums"
                  onClick={() => setTenderedStr(amt.toString())}
                >
                  ₦{amt.toLocaleString()}
                </Button>
              ))}
            </div>
            <div className="rounded-xl border bg-muted/40 p-3">
              {tenderedKobo >= totalKobo ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Change</span>
                  <span className="font-display text-xl font-bold tabular-nums text-success">
                    {formatNaira(changeKobo)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Short by</span>
                  <span className="font-display text-xl font-bold tabular-nums text-destructive">
                    {formatNaira(shortKobo)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {method !== "cash" && (
          <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
            Confirm that the {method === "pos_card" ? "POS card" : "bank transfer"} payment of{" "}
            <span className="font-semibold text-foreground">{formatNaira(totalKobo)}</span> has been received before completing the sale.
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-12 flex-1" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            className="h-12 flex-1 text-base font-semibold"
            disabled={!canConfirm || busy}
            onClick={() => onConfirm(method, tenderedKobo)}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
