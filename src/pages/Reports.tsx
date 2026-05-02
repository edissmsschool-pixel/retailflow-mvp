import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <div className="container px-3 py-4 sm:px-6 sm:py-6">
      <PageHeader
        title="Reports"
        description={view === "trends" ? `Period since ${fmtDate(sinceISO)}` : "End-of-day summary for today"}
        actions={
          <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
            <TabsList>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="eod"><CalendarClock className="mr-1.5 h-3.5 w-3.5" />End of day</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {view === "trends" && (
        <>
          <div className="mb-4 flex">
            <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
              <TabsList>
                <TabsTrigger value="daily">Daily</TabsTrigger>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

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
        </>
      )}

      {view === "eod" && <EndOfDayPanel />}
    </div>
  );
}

function EndOfDayPanel() {
  const todayStart = startOfDayISO();
  const todayEnd = endOfDayISO();

  const sales = useQuery({
    queryKey: ["eod-sales", todayStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, total_kobo, payment_method, status, created_at, cashier_id, profiles:cashier_id(full_name)")
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const items = useQuery({
    queryKey: ["eod-items", todayStart],
    queryFn: async () => {
      const ids = (sales.data ?? []).map((s) => s.id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from("sale_items")
        .select("product_id, product_name, quantity, refunded_qty, line_total_kobo")
        .in("sale_id", ids);
      return data ?? [];
    },
    enabled: !!sales.data,
  });

  const shifts = useQuery({
    queryKey: ["eod-shifts", todayStart],
    queryFn: async () => {
      const { data } = await supabase
        .from("shifts")
        .select("*, profiles:cashier_id(full_name)")
        .gte("opened_at", todayStart)
        .order("opened_at", { ascending: false });
      return data ?? [];
    },
  });

  const settings = useQuery({
    queryKey: ["eod-settings"],
    queryFn: async () => {
      const { fetchReceiptStore } = await import("@/lib/receiptStore");
      return await fetchReceiptStore();
    },
  });

  const live = sales.data ?? [];
  const completed = live.filter((s) => s.status !== "voided");
  const voided = live.filter((s) => s.status === "voided");
  const refunded = live.filter((s) => s.status === "refunded" || s.status === "partially_refunded");

  const totalsByMethod: Record<string, number> = {};
  completed.forEach((s) => {
    totalsByMethod[s.payment_method] = (totalsByMethod[s.payment_method] ?? 0) + s.total_kobo;
  });
  const grossKobo = completed.reduce((s, x) => s + x.total_kobo, 0);

  const productAgg = new Map<string, { name: string; qty: number; revenue: number }>();
  (items.data ?? []).forEach((it) => {
    const cur = productAgg.get(it.product_id) ?? { name: it.product_name, qty: 0, revenue: 0 };
    cur.qty += it.quantity - it.refunded_qty;
    cur.revenue += it.line_total_kobo;
    productAgg.set(it.product_id, cur);
  });
  const topItems = Array.from(productAgg.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);

  

  const printAggregateZ = () => {
    const z: ZReportData = {
      store_name: settings.data?.store_name ?? "Store",
      store_address: settings.data?.address,
      store_phone: settings.data?.phone,
      cashier_name: "All cashiers",
      shift_id: "EOD-" + new Date().toISOString().slice(0, 10),
      opened_at: todayStart,
      closed_at: new Date().toISOString(),
      opening_float_kobo: (shifts.data ?? []).reduce((sum, sh) => sum + (sh.opening_float_kobo ?? 0), 0),
      totals_by_method: totalsByMethod,
      txn_count: completed.length,
      refunds_kobo: 0,
      voids_count: voided.length,
      expected_cash_kobo: (totalsByMethod["cash"] ?? 0) + (shifts.data ?? []).reduce((sum, sh) => sum + (sh.opening_float_kobo ?? 0), 0),
      counted_cash_kobo: (shifts.data ?? []).reduce((sum, sh) => sum + (sh.counted_cash_kobo ?? 0), 0),
      variance_kobo: (shifts.data ?? []).reduce((sum, sh) => sum + (sh.variance_kobo ?? 0), 0),
      counted_breakdown: null,
      notes: `Day summary — ${shifts.data?.length ?? 0} shift(s)`,
    };
    printZReport(z);
  };

  const exportEod = () => {
    downloadCsv(
      [
        { metric: "Date", value: fmtDate(new Date()) },
        { metric: "Transactions", value: String(completed.length) },
        { metric: "Voided", value: String(voided.length) },
        { metric: "Refunded", value: String(refunded.length) },
        ...Object.entries(totalsByMethod).map(([k, v]) => ({ metric: `Payment: ${k}`, value: formatNaira(v) })),
        { metric: "Gross", value: formatNaira(grossKobo) },
      ],
      `eod_${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={exportEod}><Download className="mr-2 h-4 w-4" />CSV</Button>
        <Button size="sm" onClick={printAggregateZ}><Printer className="mr-2 h-4 w-4" />Print day Z-report</Button>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="shadow-card"><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Gross sales</div>
          <div className="mt-1 font-display text-xl font-bold tabular-nums">{formatNaira(grossKobo)}</div>
        </CardContent></Card>
        <Card className="shadow-card"><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Transactions</div>
          <div className="mt-1 font-display text-xl font-bold tabular-nums">{completed.length}</div>
        </CardContent></Card>
        <Card className="shadow-card"><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Refunded</div>
          <div className="mt-1 font-display text-xl font-bold tabular-nums">{refunded.length}</div>
        </CardContent></Card>
        <Card className="shadow-card"><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Voided</div>
          <div className="mt-1 font-display text-xl font-bold tabular-nums">{voided.length}</div>
        </CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Sales by payment method</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {Object.keys(totalsByMethod).length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">No sales today.</div>
              )}
              {Object.entries(totalsByMethod).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                  <span className="text-sm capitalize">{k.replace("_", " ")}</span>
                  <span className="font-mono text-sm tabular-nums">{formatNaira(v)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Top items today</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
              <TableBody>
                {topItems.map((p, i) => (
                  <TableRow key={i}><TableCell className="truncate max-w-[160px]">{p.name}</TableCell><TableCell className="text-right tabular-nums">{p.qty}</TableCell><TableCell className="text-right tabular-nums">{formatNaira(p.revenue)}</TableCell></TableRow>
                ))}
                {topItems.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground">No items sold today.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-base">Today's shifts &amp; cash variance</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Cashier</TableHead><TableHead>Opened</TableHead><TableHead>Status</TableHead>
              <TableHead className="text-right">Float</TableHead>
              <TableHead className="text-right">Expected</TableHead>
              <TableHead className="text-right">Counted</TableHead>
              <TableHead className="text-right">Variance</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(shifts.data ?? []).map((s) => {
                const v = s.variance_kobo ?? 0;
                return (
                  <TableRow key={s.id}>
                    <TableCell>{(s.profiles as { full_name?: string } | null)?.full_name ?? "—"}</TableCell>
                    <TableCell className="text-xs">{fmtDateTime(s.opened_at)}</TableCell>
                    <TableCell>
                      {s.status === "open" ? <Badge variant="secondary">Open</Badge> : <Badge>Closed</Badge>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNaira(s.opening_float_kobo)}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.expected_cash_kobo != null ? formatNaira(s.expected_cash_kobo) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.counted_cash_kobo != null ? formatNaira(s.counted_cash_kobo) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.variance_kobo != null ? (
                        <span className={v === 0 ? "" : v > 0 ? "text-success" : "text-destructive"}>
                          {v > 0 ? "+" : ""}{formatNaira(v)}
                        </span>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(shifts.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">No shifts opened today.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
