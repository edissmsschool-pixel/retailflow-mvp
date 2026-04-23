import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { formatNaira, parseKoboInput } from "@/lib/money";

export interface CartLine {
  product_id: string;
  name: string;
  sku: string;
  unit_price_kobo: number;
  quantity: number;
  line_discount_kobo: number;
  available: number;
}

interface Props {
  cart: CartLine[];
  onUpdateQty: (id: string, delta: number) => void;
  onSetQty: (id: string, q: number) => void;
  onSetDiscount: (id: string, kobo: number) => void;
  onRemove: (id: string) => void;
}

export function CartList({ cart, onUpdateQty, onSetQty, onSetDiscount, onRemove }: Props) {
  if (!cart.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-muted-foreground">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <ShoppingCart className="h-7 w-7 opacity-50" />
        </div>
        <div>
          <div className="font-medium text-foreground">Your cart is empty</div>
          <div className="text-xs">Scan or tap a product to add it.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {cart.map((l) => {
        const lineTotal = Math.max(0, l.unit_price_kobo * l.quantity - l.line_discount_kobo);
        return (
          <div
            key={l.product_id}
            className="animate-fade-in rounded-xl border bg-card p-3 shadow-card"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{l.name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatNaira(l.unit_price_kobo)} • {l.sku}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10"
                onClick={() => onRemove(l.product_id)}
                aria-label="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center rounded-full border bg-background">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={() => onUpdateQty(l.product_id, -1)}
                  aria-label="Decrease"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={l.quantity}
                  min={1}
                  max={l.available}
                  onChange={(e) => onSetQty(l.product_id, parseInt(e.target.value) || 1)}
                  className="h-10 w-12 border-0 bg-transparent p-0 text-center text-sm font-semibold tabular-nums focus-visible:ring-0"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={() => onUpdateQty(l.product_id, 1)}
                  aria-label="Increase"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold tabular-nums">{formatNaira(lineTotal)}</div>
                {l.line_discount_kobo > 0 && (
                  <div className="text-[10px] tabular-nums text-muted-foreground">
                    −{formatNaira(l.line_discount_kobo)}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-2">
              <Input
                placeholder="Line discount ₦ (optional)"
                inputMode="decimal"
                defaultValue={l.line_discount_kobo ? (l.line_discount_kobo / 100).toString() : ""}
                onBlur={(e) => onSetDiscount(l.product_id, parseKoboInput(e.target.value))}
                className="h-9 text-xs"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
