import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNaira } from "@/lib/money";
import { startOfDayISO, endOfDayISO, daysAgoISO, fmtDate } from "@/lib/dates";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from "recharts";
import { Receipt as ReceiptIcon, ShoppingBag, Boxes, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const today = useQuery({
    queryKey: ["dashboard-today"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales")
        .select("total_kobo, status")
        .gte("created_at", startOfDayISO())
        .lte("created_at", endOfDayISO());
      if (error) throw error;
      const completed = (data ?? []).filter((s) => s.status !== "voided");
      return {
        revenue: completed.reduce((sum, s) => sum + (s.total_kobo ?? 0), 0),
        count: completed.length,
      };
    },
  });

  const itemsToday = useQuery({
    queryKey: ["dashboard-items-today"],
    queryFn: async () => {
      const { data: salesIds } = await supabase.from("sales").select("id")
        .gte("created_at", startOfDayISO()).lte("created_at", endOfDayISO()).neq("status", "voided");
      const ids = (salesIds ?? []).map((s) => s.id);
      if (!ids.length) return 0;
      const { data } = await supabase.from("sale_items").select("quantity, refunded_qty").in("sale_id", ids);
      return (data ?? []).reduce((s, it) => s + (it.quantity - it.refunded_qty), 0);
    },
  });

  const lowStock = useQuery({
    queryKey: ["dashboard-low-stock"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products")
        .select("id, name, sku, stock_qty, reorder_level")
        .eq("active", true)
        .order("stock_qty", { ascending: true })
        .limit(50);
      if (error) throw error;
      return (data ?? []).filter((p) => p.stock_qty <= p.reorder_level);
    },
  });

  const trend = useQuery({
    queryKey: ["dashboard-trend"],
    queryFn: async () => {
      const since = daysAgoISO(13);
      const { data } = await supabase.from("sales")
        .select("created_at, total_kobo, status")
        .gte("created_at", since).neq("status", "voided");
      const byDay: Record<string, number> = {};
      for (let i = 13; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
        byDay[d.toISOString().slice(0, 10)] = 0;
      }
      (data ?? []).forEach((s) => {
        const k = s.created_at.slice(0, 10);
        if (k in byDay) byDay[k] += (s.total_kobo ?? 0) / 100;
      });
      return Object.entries(byDay).map(([date, total]) => ({ date: date.slice(5), total }));
    },
  });

  const topProducts = useQuery({
    queryKey: ["dashboard-top-products"],
    queryFn: async () => {
      const since = daysAgoISO(7);
      const { data: sales } = await supabase.from("sales").select("id")
        .gte("created_at", since).neq("status", "voided");
      const ids = (sales ?? []).map((s) => s.id);
      if (!ids.length) return [];
      const { data } = await supabase.from("sale_items")
        .select("product_name, quantity, refunded_qty, line_total_kobo").in("sale_id", ids);
      const map = new Map<string, { name: string; qty: number; revenue: number }>();
      (data ?? []).forEach((it) => {
        const cur = map.get(it.product_name) ?? { name: it.product_name, qty: 0, revenue: 0 };
        cur.qty += (it.quantity - it.refunded_qty);
        cur.revenue += it.line_total_kobo / 100;
        map.set(it.product_name, cur);
      });
      return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);
    },
  });

  return (
    <div className="container px-3 py-6 sm:px-6 sm:py-8">
      <PageHeader title="Dashboard" description={`Today, ${fmtDate(new Date())}`} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Revenue today" value={formatNaira(today.data?.revenue ?? 0)} icon={<ReceiptIcon className="h-5 w-5" />} tone="primary" />
        <StatTile label="Transactions" value={today.data?.count ?? 0} icon={<ShoppingBag className="h-5 w-5" />} tone="accent" />
        <StatTile label="Items sold" value={itemsToday.data ?? 0} icon={<Boxes className="h-5 w-5" />} tone="success" />
        <StatTile label="Low-stock items" value={lowStock.data?.length ?? 0} icon={<AlertTriangle className="h-5 w-5" />} tone="warning"
          sub={lowStock.data?.length ? <Link to="/products" className="font-medium text-primary hover:underline">View →</Link> : null} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2 sm:gap-5">
        <Card className="glass border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">Sales — last 14 days (₦)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend.data ?? []}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} fill="url(#salesGrad)" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">Top sellers — last 7 days</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts.data ?? []} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} width={120} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Bar dataKey="qty" fill="hsl(var(--accent))" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {!!lowStock.data?.length && (
        <Card className="mt-6 glass border-0 shadow-card">
          <CardHeader className="flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/15 text-warning-foreground">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <CardTitle className="font-display text-base">Low stock alerts</CardTitle>
            </div>
            <Button asChild size="sm" variant="outline" className="rounded-full">
              <Link to="/products">Manage</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border/60">
              {lowStock.data!.slice(0, 8).map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">SKU {p.sku}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 tabular-nums">
                    <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
                      {p.stock_qty} left
                    </span>
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      re-order @ {p.reorder_level}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
