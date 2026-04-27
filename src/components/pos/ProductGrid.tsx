import { Badge } from "@/components/ui/badge";
import { formatNaira } from "@/lib/money";
import { Tables } from "@/integrations/supabase/types";
import { Package } from "lucide-react";

type Product = Tables<"products">;

interface Props {
  products: Product[] | undefined;
  loading: boolean;
  onAdd: (p: Product) => void;
}

export function ProductGrid({ products, loading, onAdd }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-44 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }
  if (!products?.length) {
    return (
      <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
        <Package className="h-10 w-10 opacity-40" />
        No matching products.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => {
        const out = p.stock_qty <= 0;
        const low = !out && p.stock_qty <= p.reorder_level;
        return (
          <button
            key={p.id}
            onClick={() => onAdd(p)}
            disabled={out}
            className="group relative flex min-h-[12rem] flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-primary hover:shadow-elevated active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="relative aspect-square w-full overflow-hidden bg-muted">
              {p.image_url ? (
                <img
                  src={p.image_url}
                  alt={p.name}
                  loading="lazy"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 via-accent/10 to-secondary">
                  <Package className="h-10 w-10 text-muted-foreground/50" />
                </div>
              )}
              {out && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                  <Badge variant="destructive">Out of stock</Badge>
                </div>
              )}
              {low && !out && (
                <Badge variant="secondary" className="absolute right-2 top-2 bg-warning/90 text-warning-foreground">
                  Low: {p.stock_qty}
                </Badge>
              )}
            </div>
            <div className="flex flex-1 flex-col justify-between gap-1 p-3">
              <div className="line-clamp-2 text-sm font-medium leading-tight">{p.name}</div>
              <div className="flex items-end justify-between">
                <span className="font-display text-base font-bold tabular-nums text-primary">
                  {formatNaira(p.sell_price_kobo)}
                </span>
                {!low && !out && (
                  <span className="text-[10px] tabular-nums text-muted-foreground">×{p.stock_qty}</span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
