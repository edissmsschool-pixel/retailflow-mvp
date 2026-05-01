import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatNaira } from "@/lib/money";
import { daysAgoISO, fmtDate, fmtDateTime, startOfDayISO, endOfDayISO } from "@/lib/dates";
import { Download, Printer, CalendarClock } from "lucide-react";
import { downloadCsv } from "@/lib/csv";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { printZReport, type ZReportData } from "@/components/shifts/ZReport";

const PAY_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--success))"];

export default function Reports() {
  const [view, setView] = useState<"trends" | "eod">("trends");
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const sinceISO = period === "daily" ? daysAgoISO(13) : period === "weekly" ? daysAgoISO(55) : daysAgoISO(180);
  const grouping = period === "daily" ? 10 : period === "weekly" ? 7 : 7;

  const sales = useQuery({
    queryKey: ["reports-sales", period],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales")
        .select("id, total_kobo, payment_method, status, created_at, cashier_id, profiles:cashier_id(full_name)")
        .gte("created_at", sinceISO).order("created_at");
      if (error) throw error;
      return (data ?? []).filter((s) => s.status !== "voided");
    },
  });

  const items = useQuery({
    queryKey: ["reports-items", period],
    queryFn: async () => {
      const { data: salesIds } = await supabase.from("sales").select("id").gte("created_at", sinceISO).neq("status", "voided");
      const ids = (salesIds ?? []).map((s) => s.id);
      if (!ids.length) return [];
      const { data } = await supabase.from("sale_items")
        .select("product_id, product_name, sku, quantity, refunded_qty, line_total_kobo").in("sale_id", ids);
      return data ?? [];
    },
  });

  // Aggregations
  const buckets: Record<string, number> = {};
  (sales.data ?? []).forEach((s) => {
    let key = s.created_at.slice(0, grouping);
    if (period === "weekly") {
      const d = new Date(s.created_at);
      const onejan = new Date(d.getFullYear(), 0, 1);
      const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
      key = `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
    }
    buckets[key] = (buckets[key] ?? 0) + s.total_kobo / 100;
  });
  const trendData = Object.entries(buckets).map(([k, v]) => ({ period: k, total: v }));

  const byPayment: Record<string, number> = {};
  (sales.data ?? []).forEach((s) => {
    byPayment[s.payment_method] = (byPayment[s.payment_method] ?? 0) + s.total_kobo / 100;
  });
  const paymentData = Object.entries(byPayment).map(([name, value]) => ({ name, value }));

  const byCashier: Record<string, { name: string; revenue: number; count: number }> = {};
  (sales.data ?? []).forEach((s) => {
    const name = (s.profiles as { full_name?: string } | null)?.full_name || "Unknown";
    if (!byCashier[name]) byCashier[name] = { name, revenue: 0, count: 0 };
    byCashier[name].revenue += s.total_kobo / 100;
    byCashier[name].count += 1;
  });
  const cashierRows = Object.values(byCashier).sort((a, b) => b.revenue - a.revenue);

  const productAgg = new Map<string, { name: string; sku: string; qty: number; revenue: number }>();
  (items.data ?? []).forEach((it) => {
    const cur = productAgg.get(it.product_id) ?? { name: it.product_name, sku: it.sku, qty: 0, revenue: 0 };
    cur.qty += it.quantity - it.refunded_qty;
    cur.revenue += it.line_total_kobo / 100;
    productAgg.set(it.product_id, cur);
  });
  const productRows = Array.from(productAgg.values()).sort((a, b) => b.qty - a.qty);
  const bestSellers = productRows.slice(0, 10);
  const slowMovers = productRows.slice(-10).reverse();

  const exportSummary = () => {
    downloadCsv(trendData.map((t) => ({ period: t.period, revenue_naira: t.total.toFixed(2) })), `summary_${period}.csv`);
  };
  const exportProducts = () => {
    downloadCsv(productRows.map((p) => ({ product: p.name, sku: p.sku, qty: p.qty, revenue_naira: p.revenue.toFixed(2) })), `products_${period}.csv`);
  };
  const exportCashiers = () => {
    downloadCsv(cashierRows.map((c) => ({ cashier: c.name, transactions: c.count, revenue_naira: c.revenue.toFixed(2) })), `cashiers_${period}.csv`);
  };

  return (
    <div className="container py-6">
      <PageHeader title="Reports" description={`Period since ${fmtDate(sinceISO)}`}
        actions={<>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <TabsList>
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>
          </Tabs>
        </>} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Revenue ({period})</CardTitle>
            <Button variant="outline" size="sm" onClick={exportSummary}><Download className="mr-2 h-4 w-4" />CSV</Button>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Sales by payment</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} label>
                  {paymentData.map((_, i) => <Cell key={i} fill={PAY_COLORS[i % PAY_COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip formatter={(v: number) => formatNaira(v * 100)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Best sellers</CardTitle>
            <Button variant="outline" size="sm" onClick={exportProducts}><Download className="mr-2 h-4 w-4" />CSV</Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
              <TableBody>
                {bestSellers.map((p, i) => (
                  <TableRow key={i}><TableCell>{p.name}</TableCell><TableCell className="text-right tabular-nums">{p.qty}</TableCell><TableCell className="text-right tabular-nums">{formatNaira(p.revenue * 100)}</TableCell></TableRow>
                ))}
                {bestSellers.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground">No data.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Slow movers</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
              <TableBody>
                {slowMovers.map((p, i) => (
                  <TableRow key={i}><TableCell>{p.name}</TableCell><TableCell className="text-right tabular-nums">{p.qty}</TableCell><TableCell className="text-right tabular-nums">{formatNaira(p.revenue * 100)}</TableCell></TableRow>
                ))}
                {slowMovers.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground">No data.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 shadow-card">
        <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Sales by cashier</CardTitle>
          <Button variant="outline" size="sm" onClick={exportCashiers}><Download className="mr-2 h-4 w-4" />CSV</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Cashier</TableHead><TableHead className="text-right">Transactions</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
            <TableBody>
              {cashierRows.map((c, i) => (
                <TableRow key={i}><TableCell>{c.name}</TableCell><TableCell className="text-right tabular-nums">{c.count}</TableCell><TableCell className="text-right tabular-nums">{formatNaira(c.revenue * 100)}</TableCell></TableRow>
              ))}
              {cashierRows.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground">No data.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
