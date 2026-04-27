import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNaira } from "@/lib/money";

// Naira denominations in descending order (kobo values).
export const NAIRA_DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5] as const;

export type DenominationMap = Record<string, number>;

interface Props {
  value: DenominationMap;
  onChange: (next: DenominationMap, totalKobo: number) => void;
}

export function denominationsToKobo(map: DenominationMap): number {
  return NAIRA_DENOMINATIONS.reduce((s, d) => s + d * 100 * (map[String(d)] ?? 0), 0);
}

export function DenominationCounter({ value, onChange }: Props) {
  const total = useMemo(() => denominationsToKobo(value), [value]);

  const setCount = (denom: number, count: number) => {
    const next = { ...value, [String(denom)]: Math.max(0, Math.floor(count) || 0) };
    onChange(next, denominationsToKobo(next));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {NAIRA_DENOMINATIONS.map((d) => (
          <div key={d} className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">₦{d}</Label>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              className="h-11 text-center text-base font-semibold tabular-nums"
              value={value[String(d)] ?? ""}
              placeholder="0"
              onChange={(e) => setCount(d, parseInt(e.target.value || "0", 10))}
            />
            <div className="text-center text-[10px] tabular-nums text-muted-foreground">
              = {formatNaira(d * 100 * (value[String(d)] ?? 0))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
        <span className="text-sm font-medium">Counted total</span>
        <span className="font-display text-lg font-bold tabular-nums">{formatNaira(total)}</span>
      </div>
    </div>
  );
}
