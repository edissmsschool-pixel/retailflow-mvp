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
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => {
        const out = p.stock_qty <= 0;
        const low = !out && p.stock_qty <= p.reorder_level;
        return (
          <button
            key={p.id}
            onClick={() => onAdd(p)}
            disabled={out}
            aria-label={`Add ${p.name} to cart`}
            className="group relative flex min-h-[4.5rem] w-full flex-row items-stretch overflow-hidden rounded-2xl border bg-card text-left shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-primary hover:shadow-elevated active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[12rem] sm:flex-col"
          >
            <div className="relative aspect-square w-20 shrink-0 overflow-hidden bg-muted sm:w-full">
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
                  <Package className="h-7 w-7 text-muted-foreground/50" />
                </div>
              )}
              {out && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                  <Badge variant="destructive" className="text-[10px]">Out</Badge>
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-between gap-1 p-2.5 sm:p-3">
              <div className="line-clamp-2 text-[13px] font-medium leading-tight sm:text-sm">{p.name}</div>
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span className="font-display text-[15px] font-bold tabular-nums text-primary sm:text-base">
                  {formatNaira(p.sell_price_kobo)}
                </span>
                <Badge
                  variant="secondary"
                  className={
                    out
                      ? "bg-destructive/15 px-1.5 py-0 text-[10px] font-medium text-destructive"
                      : low
                        ? "bg-warning/20 px-1.5 py-0 text-[10px] font-medium text-warning-foreground"
                        : "bg-muted px-1.5 py-0 text-[10px] font-medium text-muted-foreground"
                  }
                >
                  {out ? "Out" : `${p.stock_qty} in stock`}
                </Badge>
                <span className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground sm:hidden">
                  <Plus className="h-4 w-4" />
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
