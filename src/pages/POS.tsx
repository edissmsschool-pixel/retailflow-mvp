import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatNaira, parseKoboInput, nairaToKobo } from "@/lib/money";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Minus, Plus, Search, Trash2, X, BookmarkPlus, Bookmark, Printer } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Receipt, type ReceiptData } from "@/components/Receipt";
import { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

interface CartLine {
  product_id: string;
  name: string;
  sku: string;
  unit_price_kobo: number;
  quantity: number;
  line_discount_kobo: number;
  available: number;
}

export default function POS() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [saleDiscount, setSaleDiscount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer" | "pos_card">("cash");
  const [tendered, setTendered] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [showHeld, setShowHeld] = useState(false);

  // Open shift query
  const openShift = useQuery({
    queryKey: ["open-shift", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("shifts")
        .select("*").eq("cashier_id", user!.id).eq("status", "open").maybeSingle();
      return data;
    },
  });

  // Live product search
  const products = useQuery({
    queryKey: ["pos-products", query],
    queryFn: async () => {
      let q = supabase.from("products").select("*").eq("active", true).order("name").limit(40);
      if (query.trim()) {
        const term = query.trim();
        q = supabase.from("products").select("*").eq("active", true)
          .or(`name.ilike.%${term}%,sku.ilike.%${term}%,barcode.ilike.%${term}%`).limit(40);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const heldSales = useQuery({
    queryKey: ["held-sales", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("held_sales").select("*").eq("cashier_id", user!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Auto-add by exact barcode/sku match on Enter
  const addProduct = (p: Product) => {
    setCart((c) => {
      const existing = c.find((l) => l.product_id === p.id);
      if (existing) {
        if (existing.quantity + 1 > p.stock_qty) {
          toast.error(`Only ${p.stock_qty} in stock for ${p.name}`);
          return c;
        }
        return c.map((l) => l.product_id === p.id ? { ...l, quantity: l.quantity + 1 } : l);
      }
      if (p.stock_qty <= 0) { toast.error(`${p.name} is out of stock`); return c; }
      return [...c, {
        product_id: p.id, name: p.name, sku: p.sku, unit_price_kobo: p.sell_price_kobo,
        quantity: 1, line_discount_kobo: 0, available: p.stock_qty,
      }];
    });
  };

  const handleSearchEnter = async () => {
    if (!query.trim()) return;
    const term = query.trim();
    const exact = products.data?.find((p) => p.sku === term || p.barcode === term);
    if (exact) { addProduct(exact); setQuery(""); searchRef.current?.focus(); return; }
    if (products.data?.length === 1) { addProduct(products.data[0]); setQuery(""); searchRef.current?.focus(); }
  };

  const updateQty = (id: string, delta: number) => {
    setCart((c) => c.map((l) => {
      if (l.product_id !== id) return l;
      const nq = l.quantity + delta;
      if (nq <= 0) return l;
      if (nq > l.available) { toast.error(`Only ${l.available} in stock`); return l; }
      return { ...l, quantity: nq };
    }));
  };
  const setQty = (id: string, q: number) => {
    setCart((c) => c.map((l) => {
      if (l.product_id !== id) return l;
      const clamped = Math.max(1, Math.min(q || 1, l.available));
      return { ...l, quantity: clamped };
    }));
  };
  const setLineDiscount = (id: string, kobo: number) => {
    setCart((c) => c.map((l) => l.product_id === id ? { ...l, line_discount_kobo: Math.max(0, kobo) } : l));
  };
  const removeLine = (id: string) => setCart((c) => c.filter((l) => l.product_id !== id));

  const subtotalKobo = useMemo(
    () => cart.reduce((s, l) => s + Math.max(0, l.unit_price_kobo * l.quantity - l.line_discount_kobo), 0),
    [cart]
  );
  const saleDiscountKobo = parseKoboInput(saleDiscount);
  const totalKobo = Math.max(0, subtotalKobo - saleDiscountKobo);
  const tenderedKobo = paymentMethod === "cash" ? parseKoboInput(tendered) : totalKobo;
  const changeKobo = Math.max(0, tenderedKobo - totalKobo);

  const canCheckout = cart.length > 0 && (paymentMethod !== "cash" || tenderedKobo >= totalKobo);

  const checkout = async () => {
    if (!canCheckout || !user) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("checkout", {
      body: {
        items: cart.map((l) => ({ product_id: l.product_id, quantity: l.quantity, line_discount_kobo: l.line_discount_kobo })),
        sale_discount_kobo: saleDiscountKobo,
        payment_method: paymentMethod,
        amount_tendered_kobo: paymentMethod === "cash" ? tenderedKobo : totalKobo,
        shift_id: openShift.data?.id ?? null,
      },
    });
    setBusy(false);
    if (error || (data as { error?: string })?.error) {
      toast.error((data as { error?: string })?.error ?? error?.message ?? "Checkout failed");
      return;
    }
    const sale_id = (data as { sale_id: string }).sale_id;
    await loadReceipt(sale_id);
    setCart([]); setSaleDiscount(""); setTendered("");
    qc.invalidateQueries({ queryKey: ["pos-products"] });
    qc.invalidateQueries({ queryKey: ["dashboard-today"] });
    toast.success("Sale completed");
    searchRef.current?.focus();
  };

  const loadReceipt = async (saleId: string) => {
    const { data: sale } = await supabase.from("sales").select("*, profiles:cashier_id(full_name)").eq("id", saleId).single();
    const { data: items } = await supabase.from("sale_items").select("*").eq("sale_id", saleId).order("created_at");
    const { data: settings } = await supabase.from("store_settings").select("*").eq("id", 1).single();
    if (!sale || !items || !settings) return;
    const cashierName = (sale as unknown as { profiles?: { full_name?: string } }).profiles?.full_name || "";
    setReceipt({
      store_name: settings.store_name,
      store_address: settings.address,
      store_phone: settings.phone,
      receipt_footer: settings.receipt_footer,
      sale_number: sale.sale_number,
      cashier_name: cashierName,
      created_at: sale.created_at,
      items: items.map((it) => ({
        product_name: it.product_name, sku: it.sku, quantity: it.quantity,
        unit_price_kobo: it.unit_price_kobo, line_discount_kobo: it.line_discount_kobo, line_total_kobo: it.line_total_kobo,
      })),
      subtotal_kobo: sale.subtotal_kobo, discount_kobo: sale.discount_kobo, total_kobo: sale.total_kobo,
      payment_method: sale.payment_method, amount_tendered_kobo: sale.amount_tendered_kobo, change_kobo: sale.change_kobo,
      status: sale.status,
    });
  };

  const holdSale = async () => {
    if (!cart.length || !user) return;
    const { error } = await supabase.from("held_sales").insert({
      cashier_id: user.id, label: `${cart.length} item(s)`, cart: cart as unknown as Record<string, unknown>[],
    });
    if (error) return toast.error(error.message);
    setCart([]); setSaleDiscount(""); setTendered("");
    qc.invalidateQueries({ queryKey: ["held-sales"] });
    toast.success("Sale held");
  };

  const recall = async (id: string, c: CartLine[]) => {
    setCart(c);
    await supabase.from("held_sales").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["held-sales"] });
    setShowHeld(false);
  };

  const startShift = async () => {
    if (!user) return;
    const float = window.prompt("Opening cash float (₦):", "0");
    if (float === null) return;
    const opening_float_kobo = nairaToKobo(float || "0");
    const { error } = await supabase.from("shifts").insert({ cashier_id: user.id, opening_float_kobo });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["open-shift"] });
    toast.success("Shift started");
  };

  useEffect(() => { searchRef.current?.focus(); }, []);

  return (
    <div className="container py-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        {/* Left: search + product grid */}
        <Card className="shadow-card">
          <CardHeader className="space-y-3 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Point of Sale</CardTitle>
              <div className="flex items-center gap-2">
                {openShift.data ? (
                  <Badge variant="secondary">Shift open</Badge>
                ) : (
                  <Button size="sm" variant="outline" onClick={startShift}>Start shift</Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setShowHeld(true)}>
                  <Bookmark className="mr-1 h-4 w-4" />Held ({heldSales.data?.length ?? 0})
                </Button>
              </div>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                placeholder="Scan barcode or search by name / SKU…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSearchEnter(); } }}
                className="h-12 pl-10 text-base"
                autoFocus
              />
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[60vh]">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {products.data?.map((p) => (
                  <button key={p.id} onClick={() => addProduct(p)}
                    className="group flex flex-col items-start rounded-md border bg-card p-3 text-left text-sm shadow-card transition hover:border-primary hover:shadow-elevated disabled:opacity-50"
                    disabled={p.stock_qty <= 0}>
                    <div className="line-clamp-2 font-medium">{p.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">SKU {p.sku}</div>
                    <div className="mt-2 flex w-full items-center justify-between">
                      <span className="font-semibold tabular-nums text-primary">{formatNaira(p.sell_price_kobo)}</span>
                      <Badge variant={p.stock_qty <= p.reorder_level ? "destructive" : "secondary"} className="text-[10px]">{p.stock_qty}</Badge>
                    </div>
                  </button>
                ))}
                {products.data?.length === 0 && (
                  <div className="col-span-full p-6 text-center text-sm text-muted-foreground">No matching products.</div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right: cart */}
        <Card className="flex h-[calc(100vh-9rem)] flex-col shadow-card">
          <CardHeader className="pb-3"><CardTitle className="text-base">Cart</CardTitle></CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden p-4 pt-0">
            <ScrollArea className="-mx-4 flex-1 px-4">
              {cart.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Cart is empty. Scan or tap a product to add.</div>
              ) : (
                <div className="space-y-2">
                  {cart.map((l) => (
                    <div key={l.product_id} className="rounded-md border bg-card p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{l.name}</div>
                          <div className="text-xs text-muted-foreground">{formatNaira(l.unit_price_kobo)} • SKU {l.sku}</div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeLine(l.product_id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex items-center rounded-md border">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQty(l.product_id, -1)}><Minus className="h-3 w-3" /></Button>
                          <Input type="number" value={l.quantity} min={1} max={l.available}
                            onChange={(e) => setQty(l.product_id, parseInt(e.target.value) || 1)}
                            className="h-8 w-14 border-0 text-center tabular-nums focus-visible:ring-0" />
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQty(l.product_id, 1)}><Plus className="h-3 w-3" /></Button>
                        </div>
                        <Input placeholder="Discount ₦" inputMode="decimal"
                          defaultValue={l.line_discount_kobo ? (l.line_discount_kobo / 100).toString() : ""}
                          onBlur={(e) => setLineDiscount(l.product_id, parseKoboInput(e.target.value))}
                          className="h-8 flex-1 text-sm" />
                        <div className="w-24 text-right text-sm font-semibold tabular-nums">
                          {formatNaira(Math.max(0, l.unit_price_kobo * l.quantity - l.line_discount_kobo))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between text-sm tabular-nums">
                <span className="text-muted-foreground">Subtotal</span><span>{formatNaira(subtotalKobo)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm text-muted-foreground">Sale discount (₦)</span>
                <Input value={saleDiscount} onChange={(e) => setSaleDiscount(e.target.value)} inputMode="decimal" className="h-8 w-32 text-right" />
              </div>
              <div className="flex items-center justify-between font-display text-xl font-bold tabular-nums">
                <span>Total</span><span>{formatNaira(totalKobo)}</span>
              </div>

              <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="cash">Cash</TabsTrigger>
                  <TabsTrigger value="transfer">Transfer</TabsTrigger>
                  <TabsTrigger value="pos_card">POS card</TabsTrigger>
                </TabsList>
              </Tabs>

              {paymentMethod === "cash" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Tendered (₦)</label>
                    <Input value={tendered} onChange={(e) => setTendered(e.target.value)} inputMode="decimal" className="h-9" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Change</label>
                    <div className="flex h-9 items-center rounded-md border bg-muted px-3 font-semibold tabular-nums">{formatNaira(changeKobo)}</div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" disabled={!cart.length} onClick={holdSale}>
                  <BookmarkPlus className="mr-1 h-4 w-4" />Hold
                </Button>
                <Button variant="outline" disabled={!cart.length} onClick={() => { setCart([]); setSaleDiscount(""); setTendered(""); }}>
                  <X className="mr-1 h-4 w-4" />Clear
                </Button>
                <Button className="flex-1" size="lg" disabled={!canCheckout || busy} onClick={checkout}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Charge
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Held sales dialog */}
      <Dialog open={showHeld} onOpenChange={setShowHeld}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Held sales</DialogTitle></DialogHeader>
          <div className="max-h-80 space-y-2 overflow-auto">
            {heldSales.data?.length === 0 && <div className="text-sm text-muted-foreground">No held sales.</div>}
            {heldSales.data?.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">{h.label || "Held sale"}</div>
                  <div className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => recall(h.id, h.cart as unknown as CartLine[])}>Recall</Button>
                  <Button size="sm" variant="ghost" onClick={async () => {
                    await supabase.from("held_sales").delete().eq("id", h.id);
                    qc.invalidateQueries({ queryKey: ["held-sales"] });
                  }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt dialog */}
      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Receipt</DialogTitle></DialogHeader>
          {receipt && <Receipt data={receipt} />}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReceipt(null)}>Close</Button>
            <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
