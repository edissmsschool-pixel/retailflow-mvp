import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatNaira, parseKoboInput, nairaToKobo } from "@/lib/money";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Bookmark, BookmarkPlus, ScanLine, Search, ShoppingCart, Trash2 } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { type ReceiptData } from "@/components/Receipt";
import { ProductGrid } from "@/components/pos/ProductGrid";
import { CartList, type CartLine } from "@/components/pos/CartList";
import { CartSummary } from "@/components/pos/CartSummary";
import { PaymentDialog, type PaymentMethod } from "@/components/pos/PaymentDialog";
import { ReceiptDialog } from "@/components/pos/ReceiptDialog";
import { BarcodeScanner } from "@/components/pos/BarcodeScanner";
import { DenominationCounter, type DenominationMap } from "@/components/shifts/DenominationCounter";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fetchReceiptStore } from "@/lib/receiptStore";

type Product = Tables<"products">;
type Category = Tables<"categories">;

export default function POS() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | "all">("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [saleDiscount, setSaleDiscount] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [showHeld, setShowHeld] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showStartShift, setShowStartShift] = useState(false);
  const [openingFloat, setOpeningFloat] = useState("");
  const [openingFloatBreakdown, setOpeningFloatBreakdown] = useState<Record<string, number>>({});
  const [openingFloatKobo, setOpeningFloatKobo] = useState(0);

  const openShift = useQuery({
    queryKey: ["open-shift", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("shifts")
        .select("*").eq("cashier_id", user!.id).eq("status", "open").maybeSingle();
      return data;
    },
  });

  const categories = useQuery({
    queryKey: ["pos-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("name");
      return (data ?? []) as Category[];
    },
  });

  const products = useQuery({
    queryKey: ["pos-products", query, categoryId],
    queryFn: async () => {
      let q = supabase.from("products").select("*").eq("active", true).order("name").limit(60);
      if (categoryId !== "all") q = q.eq("category_id", categoryId);
      if (query.trim()) {
        const term = query.trim();
        q = q.or(`name.ilike.%${term}%,sku.ilike.%${term}%,barcode.ilike.%${term}%`);
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

  const handleSearchEnter = () => {
    if (!query.trim()) return;
    const term = query.trim();
    const exact = products.data?.find((p) => p.sku === term || p.barcode === term);
    if (exact) { addProduct(exact); setQuery(""); searchRef.current?.focus(); return; }
    if (products.data?.length === 1) { addProduct(products.data[0]); setQuery(""); searchRef.current?.focus(); }
  };

  const handleScanned = async (code: string) => {
    const term = code.trim();
    if (!term) return;
    // Try local cache first
    let match = products.data?.find((p) => p.barcode === term || p.sku === term);
    if (!match) {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .or(`barcode.eq.${term},sku.eq.${term}`)
        .limit(1)
        .maybeSingle();
      match = (data ?? undefined) as Product | undefined;
    }
    if (match) {
      addProduct(match);
      toast.success(`Added ${match.name}`);
    } else {
      toast.error(`No product for code ${term}`);
      setQuery(term);
    }
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
  const clearCart = () => { setCart([]); setSaleDiscount(""); };

  const subtotalKobo = useMemo(
    () => cart.reduce((s, l) => s + Math.max(0, l.unit_price_kobo * l.quantity - l.line_discount_kobo), 0),
    [cart]
  );
  const itemCount = useMemo(() => cart.reduce((s, l) => s + l.quantity, 0), [cart]);
  const saleDiscountKobo = parseKoboInput(saleDiscount);
  const totalKobo = Math.max(0, subtotalKobo - saleDiscountKobo);

  const checkout = async (method: PaymentMethod, tenderedKobo: number) => {
    if (!user || !cart.length) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("checkout", {
      body: {
        items: cart.map((l) => ({
          product_id: l.product_id, quantity: l.quantity, line_discount_kobo: l.line_discount_kobo,
        })),
        sale_discount_kobo: saleDiscountKobo,
        payment_method: method,
        amount_tendered_kobo: method === "cash" ? tenderedKobo : totalKobo,
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
    clearCart();
    setShowPayment(false);
    setShowCart(false);
    qc.invalidateQueries({ queryKey: ["pos-products"] });
    qc.invalidateQueries({ queryKey: ["dashboard-today"] });
    toast.success("Sale completed");
    searchRef.current?.focus();
  };

  const loadReceipt = async (saleId: string) => {
    const { data: sale } = await supabase.from("sales").select("*, profiles:cashier_id(full_name)").eq("id", saleId).single();
    const { data: items } = await supabase.from("sale_items").select("*").eq("sale_id", saleId).order("created_at");
    const settings = await fetchReceiptStore();
    if (!sale || !items) return;
    const cashierName = (sale as unknown as { profiles?: { full_name?: string } }).profiles?.full_name || "";
    setReceipt({
      store_name: settings.store_name,
      store_address: settings.address,
      store_phone: settings.phone,
      receipt_footer: settings.receipt_footer,
      store_logo_url: settings.logo_url,
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
    const label = `${cart.length} item(s) • ${formatNaira(totalKobo)}`;
    const { error } = await supabase.from("held_sales").insert({
      cashier_id: user.id,
      label,
      cart: cart as unknown as never,
    });
    if (error) return toast.error(error.message);

    // Build a hold-slip receipt and trigger silent auto-print so the customer
    // walks away with a paper record of what is being held.
    const settings = await fetchReceiptStore();
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    if (settings) {
      setReceipt({
        store_name: settings.store_name,
        store_address: settings.address,
        store_phone: settings.phone,
        receipt_footer: `HOLD SLIP — ${label}\n${settings.receipt_footer ?? ""}`,
        store_logo_url: settings.logo_url,
        sale_number: `HOLD-${Date.now().toString().slice(-6)}`,
        cashier_name: profile?.full_name || "",
        created_at: new Date().toISOString(),
        items: cart.map((l) => ({
          product_name: l.name,
          sku: l.sku,
          quantity: l.quantity,
          unit_price_kobo: l.unit_price_kobo,
          line_discount_kobo: l.line_discount_kobo,
          line_total_kobo: Math.max(0, l.unit_price_kobo * l.quantity - l.line_discount_kobo),
        })),
        subtotal_kobo: subtotalKobo,
        discount_kobo: saleDiscountKobo,
        total_kobo: totalKobo,
        payment_method: "cash",
        amount_tendered_kobo: 0,
        change_kobo: 0,
        status: "on_hold",
      });
    }

    clearCart();
    qc.invalidateQueries({ queryKey: ["held-sales"] });
    toast.success("Sale held — printing slip");
  };

  const recall = async (id: string, c: CartLine[]) => {
    setCart(c);
    await supabase.from("held_sales").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["held-sales"] });
    setShowHeld(false);
  };

  const openStartShift = () => {
    setOpeningFloat("");
    setOpeningFloatBreakdown({});
    setOpeningFloatKobo(0);
    setShowStartShift(true);
  };

  const startShift = async () => {
    if (!user) return;
    // Prefer denomination total when any counts entered, else manual input.
    const opening_float_kobo = openingFloatKobo > 0 ? openingFloatKobo : nairaToKobo(openingFloat || "0");
    const { error } = await supabase.from("shifts").insert({ cashier_id: user.id, opening_float_kobo });
    if (error) return toast.error(error.message);
    setShowStartShift(false);
    qc.invalidateQueries({ queryKey: ["open-shift"] });
    toast.success("Shift started");
  };

  useEffect(() => { searchRef.current?.focus(); }, []);

  // ---------- Cart panel (shared between desktop sidebar and mobile sheet) ----------
  const CartPanel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          <span className="font-display text-base font-semibold">Current Sale</span>
          {itemCount > 0 && (
            <Badge variant="secondary" className="tabular-nums">{itemCount}</Badge>
          )}
        </div>
        {cart.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs text-muted-foreground hover:text-destructive"
            onClick={clearCart}
          >
            <Trash2 className="mr-1 h-3 w-3" />Clear
          </Button>
        )}
      </div>

      <ScrollArea className="-mx-1 min-h-0 flex-1 px-1">
        <CartList
          cart={cart}
          onUpdateQty={updateQty}
          onSetQty={setQty}
          onSetDiscount={setLineDiscount}
          onRemove={removeLine}
        />
      </ScrollArea>

      <div className="sticky bottom-0 -mx-4 mt-2 border-t border-border/50 bg-background/95 px-4 pb-[env(safe-area-inset-bottom)] pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <CartSummary
          itemCount={itemCount}
          subtotalKobo={subtotalKobo}
          saleDiscount={saleDiscount}
          onSaleDiscountChange={setSaleDiscount}
          totalKobo={totalKobo}
        />

        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            className="h-14 flex-1"
            disabled={!cart.length}
            onClick={holdSale}
          >
            <BookmarkPlus className="mr-1 h-4 w-4" />Hold
          </Button>
          <Button
            className="h-14 flex-[2] text-base font-semibold shadow-elevated"
            disabled={!cart.length}
            onClick={() => setShowPayment(true)}
          >
            Checkout • {formatNaira(totalKobo)}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container max-w-screen-2xl overflow-x-hidden px-3 py-3 sm:px-4 sm:py-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        {/* ===== Products column ===== */}
        <Card className="shadow-card">
          <CardHeader className="space-y-3 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="hidden text-base sm:block">Point of Sale</CardTitle>
              <div className="ml-auto flex items-center gap-2">
                {openShift.data ? (
                  <Badge variant="secondary" className="bg-success/10 text-success">Shift open</Badge>
                ) : (
                  <Button size="sm" variant="outline" className="h-9" onClick={openStartShift}>Start shift</Button>
                )}
                <Button size="sm" variant="outline" className="h-9" onClick={() => setShowHeld(true)}>
                  <Bookmark className="mr-1 h-4 w-4" />
                  <span className="hidden sm:inline">Held</span> ({heldSales.data?.length ?? 0})
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  placeholder="Scan barcode or search by name / SKU…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSearchEnter(); } }}
                  className="h-11 pl-10 text-base sm:h-12"
                  autoFocus
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-11 shrink-0 p-0 sm:h-12 sm:w-12"
                aria-label="Scan barcode with camera"
                onClick={() => setShowScanner(true)}
              >
                <ScanLine className="h-5 w-5" />
              </Button>
            </div>
            {/* Category chips */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                onClick={() => setCategoryId("all")}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 sm:px-4 sm:py-2",
                  categoryId === "all"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary/40"
                )}
              >
                All
              </button>
              {categories.data?.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoryId(c.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 sm:px-4 sm:py-2",
                    categoryId === c.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="pb-32 lg:pb-6">
            <ScrollArea className="h-[calc(100vh-26rem)] lg:h-[calc(100vh-19rem)]">
              <div className="pr-2">
                <ProductGrid
                  products={products.data}
                  loading={products.isLoading}
                  onAdd={addProduct}
                />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* ===== Desktop cart panel ===== */}
        <Card className="hidden h-[calc(100vh-6rem)] flex-col shadow-card lg:flex">
          <CardContent className="flex flex-1 flex-col overflow-hidden p-4">
            {CartPanel}
          </CardContent>
        </Card>
      </div>

      {/* ===== Mobile sticky checkout bar (sits above bottom nav) ===== */}
      <div className="fixed inset-x-0 z-40 border-t border-border/60 glass-strong px-3 py-2 shadow-elevated lg:hidden" style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}>
        <Sheet open={showCart} onOpenChange={setShowCart}>
          <SheetTrigger asChild>
            <Button
              className="h-12 w-full justify-between text-sm font-semibold shadow-elevated"
              disabled={!cart.length && itemCount === 0}
            >
              <span className="flex items-center gap-2">
                <div className="relative">
                  <ShoppingCart className="h-5 w-5" />
                  {itemCount > 0 && (
                    <span className="absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                      {itemCount}
                    </span>
                  )}
                </div>
                {cart.length === 0 ? "Cart empty" : "View Cart"}
              </span>
              <span className="tabular-nums">{formatNaira(totalKobo)}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[92vh] rounded-t-2xl p-4">
            <SheetHeader className="text-left">
              <SheetTitle className="sr-only">Cart</SheetTitle>
            </SheetHeader>
            <div className="flex h-full flex-col pt-2">{CartPanel}</div>
          </SheetContent>
        </Sheet>
      </div>

      {/* ===== Held sales dialog ===== */}
      <Dialog open={showHeld} onOpenChange={setShowHeld}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Held sales</DialogTitle>
            <DialogDescription className="sr-only">
              Recall or delete previously held carts.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-auto">
            {heldSales.data?.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">No held sales.</div>
            )}
            {heldSales.data?.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-xl border p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{h.label || "Held sale"}</div>
                  <div className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-9" onClick={() => recall(h.id, h.cart as unknown as CartLine[])}>Recall</Button>
                  <Button size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={async () => {
                    await supabase.from("held_sales").delete().eq("id", h.id);
                    qc.invalidateQueries({ queryKey: ["held-sales"] });
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Payment ===== */}
      <PaymentDialog
        open={showPayment}
        onOpenChange={setShowPayment}
        totalKobo={totalKobo}
        busy={busy}
        onConfirm={checkout}
      />

      {/* ===== Receipt ===== */}
      <ReceiptDialog data={receipt} onClose={() => setReceipt(null)} />

      {/* ===== Camera barcode + image scanner ===== */}
      <BarcodeScanner
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onDetected={handleScanned}
        onIdentified={(p) => addProduct(p as Product)}
      />

      {/* ===== Start shift dialog ===== */}
      <Dialog open={showStartShift} onOpenChange={setShowStartShift}>
        <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Start shift</DialogTitle>
            <DialogDescription>
              Count the cash drawer to set the opening float, or enter a manual amount.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block text-sm">Count drawer (denominations)</Label>
              <DenominationCounter
                value={openingFloatBreakdown}
                onChange={(b: DenominationMap, total) => {
                  setOpeningFloatBreakdown(b);
                  setOpeningFloatKobo(total);
                  if (total > 0) setOpeningFloat("");
                }}
              />
            </div>
            <div className="relative flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
            </div>
            <div className="space-y-1.5">
              <Label>Manual opening float (₦)</Label>
              <Input
                inputMode="decimal"
                placeholder="0"
                value={openingFloat}
                onChange={(e) => {
                  setOpeningFloat(e.target.value);
                  if (e.target.value) {
                    setOpeningFloatBreakdown({});
                    setOpeningFloatKobo(0);
                  }
                }}
              />
            </div>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowStartShift(false)}>Cancel</Button>
            <Button onClick={startShift}>Start shift</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
