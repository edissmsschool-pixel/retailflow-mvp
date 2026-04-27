import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, ArrowUpDown, AlertTriangle, Sparkles, Upload, Loader2, Package } from "lucide-react";
import { formatNaira, nairaToKobo, koboToNaira } from "@/lib/money";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { generateSku } from "@/lib/sku";
import { ImportDialog } from "@/components/products/ImportDialog";
import { ImageUploader } from "@/components/products/ImageUploader";

type Product = Tables<"products">;

interface ProductForm {
  id?: string;
  name: string;
  sku: string;
  barcode: string;
  category_id: string | null;
  cost_price: string;
  sell_price: string;
  stock_qty: string;
  reorder_level: string;
  image_url: string | null;
}

const empty: ProductForm = {
  name: "", sku: "", barcode: "", category_id: null,
  cost_price: "", sell_price: "", stock_qty: "0", reorder_level: "5", image_url: null,
};

export default function Products() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showLow, setShowLow] = useState(false);
  const [editing, setEditing] = useState<ProductForm | null>(null);
  const [adjustFor, setAdjustFor] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("restock");
  const [importOpen, setImportOpen] = useState(false);
  const [generatingSku, setGeneratingSku] = useState(false);

  const products = useQuery({
    queryKey: ["products-list", search],
    queryFn: async () => {
      let q = supabase.from("products").select("*, categories(name)").order("name");
      if (search.trim()) {
        q = supabase.from("products").select("*, categories(name)")
          .or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`).order("name");
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as (Product & { categories: { name: string } | null })[];
    },
  });

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("name");
      return data ?? [];
    },
  });

  const filtered = (products.data ?? []).filter((p) => !showLow || p.stock_qty <= p.reorder_level);

  const save = async () => {
    if (!editing) return;
    const payload = {
      name: editing.name.trim(),
      sku: editing.sku.trim(),
      barcode: editing.barcode.trim() || null,
      category_id: editing.category_id,
      cost_price_kobo: nairaToKobo(editing.cost_price || "0"),
      sell_price_kobo: nairaToKobo(editing.sell_price || "0"),
      reorder_level: parseInt(editing.reorder_level || "0") || 0,
      image_url: editing.image_url,
    };
    if (!payload.name || !payload.sku) { toast.error("Name and SKU are required"); return; }
    if (editing.id) {
      const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Product updated");
    } else {
      const { error } = await supabase.from("products").insert({ ...payload, stock_qty: parseInt(editing.stock_qty || "0") || 0 });
      if (error) return toast.error(error.message);
      toast.success("Product created");
    }
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["products-list"] });
    qc.invalidateQueries({ queryKey: ["pos-products"] });
  };

  const adjust = async () => {
    if (!adjustFor || !adjustQty) return;
    const change = parseInt(adjustQty);
    if (!Number.isInteger(change) || change === 0) { toast.error("Enter a non-zero integer"); return; }
    const { error } = await supabase.functions.invoke("adjust-stock", {
      body: { product_id: adjustFor.id, change_qty: change, reason: adjustReason },
    });
    if (error) return toast.error(error.message);
    toast.success("Stock adjusted");
    setAdjustFor(null); setAdjustQty("");
    qc.invalidateQueries({ queryKey: ["products-list"] });
    qc.invalidateQueries({ queryKey: ["pos-products"] });
  };

  const startEdit = (p: Product & { categories: { name: string } | null }) => setEditing({
    id: p.id, name: p.name, sku: p.sku, barcode: p.barcode ?? "", category_id: p.category_id,
    cost_price: koboToNaira(p.cost_price_kobo).toString(),
    sell_price: koboToNaira(p.sell_price_kobo).toString(),
    stock_qty: p.stock_qty.toString(), reorder_level: p.reorder_level.toString(),
    image_url: p.image_url ?? null,
  });

  return (
    <div className="container px-3 py-4 sm:px-6 sm:py-6">
      <PageHeader
        title="Products & Inventory"
        description="Manage your catalog and stock levels."
        actions={
          <>
            <Button variant={showLow ? "default" : "outline"} onClick={() => setShowLow((v) => !v)}>
              <AlertTriangle className="mr-2 h-4 w-4" />Low stock
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />Import CSV
            </Button>
            <Button onClick={() => setEditing(empty)}><Plus className="mr-2 h-4 w-4" />New product</Button>
          </>
        }
      />
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => {
          qc.invalidateQueries({ queryKey: ["products-list"] });
          qc.invalidateQueries({ queryKey: ["pos-products"] });
          qc.invalidateQueries({ queryKey: ["categories"] });
        }}
      />
      <Card className="shadow-card">
        <CardContent className="p-3 sm:p-4">
          <Input placeholder="Search by name, SKU or barcode…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4" />

          {/* Mobile: stacked cards */}
          <div className="space-y-2 sm:hidden">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => startEdit(p)}
                className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-sm active:scale-[0.99]"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover"
                      onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-secondary">
                      <Package className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">{p.sku} • {p.categories?.name ?? "—"}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-display text-sm font-bold tabular-nums text-primary">{formatNaira(p.sell_price_kobo)}</span>
                    <Badge variant={p.stock_qty <= p.reorder_level ? "destructive" : "secondary"} className="text-[10px]">
                      {p.stock_qty} in stock
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => { e.stopPropagation(); setAdjustFor(p); }}
                  aria-label="Adjust stock"
                >
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">No products found.</div>
            )}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="h-9 w-9 overflow-hidden rounded-md bg-muted">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="h-full w-full object-cover"
                            onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-secondary">
                            <Package className="h-3.5 w-3.5 text-muted-foreground/60" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.categories?.name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNaira(p.sell_price_kobo)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Badge variant={p.stock_qty <= p.reorder_level ? "destructive" : "secondary"}>{p.stock_qty}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setAdjustFor(p)}><ArrowUpDown className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => startEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No products found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit product" : "New product"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <div>
                <Label className="mb-1.5 block">Image</Label>
                <ImageUploader
                  value={editing.image_url}
                  productName={editing.name}
                  onChange={(url) => setEditing({ ...editing, image_url: url })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Name</Label>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>SKU</Label>
                  <div className="flex gap-2">
                    <Input value={editing.sku} onChange={(e) => setEditing({ ...editing, sku: e.target.value })} />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="Auto-generate SKU"
                      disabled={generatingSku}
                      onClick={async () => {
                        setGeneratingSku(true);
                        try {
                          const cat = categories.data?.find((c) => c.id === editing.category_id)?.name ?? null;
                          const sku = await generateSku(cat);
                          setEditing({ ...editing, sku });
                        } finally {
                          setGeneratingSku(false);
                        }
                      }}
                    >
                      {generatingSku ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Barcode</Label>
                  <Input value={editing.barcode} onChange={(e) => setEditing({ ...editing, barcode: e.target.value })} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Category</Label>
                  <Select value={editing.category_id ?? "none"} onValueChange={(v) => setEditing({ ...editing, category_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {categories.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Cost price (₦)</Label>
                  <Input inputMode="decimal" value={editing.cost_price} onChange={(e) => setEditing({ ...editing, cost_price: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Sell price (₦)</Label>
                  <Input inputMode="decimal" value={editing.sell_price} onChange={(e) => setEditing({ ...editing, sell_price: e.target.value })} />
                </div>
                {!editing.id && (
                  <div className="space-y-1.5">
                    <Label>Initial stock</Label>
                    <Input type="number" value={editing.stock_qty} onChange={(e) => setEditing({ ...editing, stock_qty: e.target.value })} />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Re-order level</Label>
                  <Input type="number" value={editing.reorder_level} onChange={(e) => setEditing({ ...editing, reorder_level: e.target.value })} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!adjustFor} onOpenChange={(o) => !o && setAdjustFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Adjust stock — {adjustFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Current: <strong className="text-foreground">{adjustFor?.stock_qty}</strong></div>
            <div className="space-y-1.5">
              <Label>Change quantity (positive to add, negative to remove)</Label>
              <Input type="number" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Select value={adjustReason} onValueChange={setAdjustReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="restock">Restock</SelectItem>
                  <SelectItem value="damage">Damage</SelectItem>
                  <SelectItem value="correction">Correction</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustFor(null)}>Cancel</Button>
            <Button onClick={adjust}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
