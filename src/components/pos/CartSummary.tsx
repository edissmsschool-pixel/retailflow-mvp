import { Input } from "@/components/ui/input";
import { formatNaira } from "@/lib/money";

interface Props {
  itemCount: number;
  subtotalKobo: number;
  saleDiscount: string;
  onSaleDiscountChange: (v: string) => void;
  totalKobo: number;
}

export function CartSummary({ itemCount, subtotalKobo, saleDiscount, onSaleDiscountChange, totalKobo }: Props) {
  return (
    <div className="space-y-2 border-t pt-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Items</span>
        <span className="font-medium tabular-nums">{itemCount}</span>
      </div>
      <div className="flex items-center justify-between text-sm tabular-nums">
        <span className="text-muted-foreground">Subtotal</span>
        <span>{formatNaira(subtotalKobo)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm text-muted-foreground">Discount (₦)</span>
        <Input
          value={saleDiscount}
          onChange={(e) => onSaleDiscountChange(e.target.value)}
          inputMode="decimal"
          placeholder="0"
          className="h-9 w-32 text-right tabular-nums"
        />
      </div>
      <div className="flex items-end justify-between rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 p-3">
        <span className="text-sm font-medium text-muted-foreground">Grand Total</span>
        <span className="font-display text-2xl font-bold tabular-nums text-primary">
          {formatNaira(totalKobo)}
        </span>
      </div>
    </div>
  );
}
