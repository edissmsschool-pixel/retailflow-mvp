import { Badge } from "@/components/ui/badge";
import { formatNaira } from "@/lib/money";
import { Tables } from "@/integrations/supabase/types";
import { Package, Plus } from "lucide-react";

type Product = Tables<"products">;

interface Props {
  products: Product[] | undefined;
  loading: boolean;
  onAdd: (p: Product) => void;
}

export function ProductGrid({ products, loading, onAdd }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted sm:h-44" />
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => {
        const out = p.stock_qty <= 0;
        const low = !out && p.stock_qty <= p.reorder_level;
        return (
          <button
            key={p.id}
            onClick={() => onAdd(p)}
            disabled={out}
            aria-label={`Add ${p.name} to cart`}
            className="group relative flex min-h-[5rem] w-full flex-row items-stretch overflow-hidden rounded-2xl border bg-card text-left shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-primary hover:shadow-elevated active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[12rem] sm:flex-col"
          >
            <div className="relative aspect-square w-24 shrink-0 overflow-hidden bg-muted sm:w-full">
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
                  <Package className="h-8 w-8 text-muted-foreground/50" />
                </div>
              )}
              {out && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                  <Badge variant="destructive" className="text-[10px]">Out</Badge>
                </div>
              )}
              {low && !out && (
                <Badge variant="secondary" className="absolute right-1 top-1 bg-warning/90 px-1.5 py-0 text-[10px] text-warning-foreground">
                  {p.stock_qty}
                </Badge>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-between gap-1 p-3">
              <div className="line-clamp-2 text-sm font-medium leading-tight">{p.name}</div>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <span className="font-display text-base font-bold tabular-nums text-primary">
                  {formatNaira(p.sell_price_kobo)}
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground sm:hidden">
                  <Plus className="h-4 w-4" />
                </span>
              </div>
              <Badge
                variant="secondary"
                className={
                  out
                    ? "w-fit bg-destructive/15 px-2 py-0 text-[10px] font-medium text-destructive"
                    : low
                      ? "w-fit bg-warning/15 px-2 py-0 text-[10px] font-medium text-warning-foreground"
                      : "w-fit bg-muted px-2 py-0 text-[10px] font-medium text-muted-foreground"
                }
              >
                {out ? "Out of stock" : `${p.stock_qty} in stock`}
              </Badge>
            </div>
          </button>
        );
      })}
    </div>
  );
}
