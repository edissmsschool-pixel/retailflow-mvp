import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { parseCsv, downloadCsv } from "@/lib/csv";
import { nairaToKobo } from "@/lib/money";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Upload, Loader2 } from "lucide-react";

interface ParsedRow {
  sku: string;
  name: string;
  barcode: string;
  category: string;
  cost_price: string;
  sell_price: string;
  stock_qty: string;
  reorder_level: string;
  active: string;
  errors: string[];
}

export function ImportDialog({ open, onOpenChange, onImported }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImported: () => void;
}) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [filename, setFilename] = useState("");

  const handleFile = async (file: File) => {
    setFilename(file.name);
    const text = await file.text();
    const parsed = parseCsv(text);
    const validated: ParsedRow[] = parsed.map((r) => {
      const row: ParsedRow = {
        sku: r.sku ?? "",
        name: r.name ?? "",
        barcode: r.barcode ?? "",
        category: r.category ?? "",
        cost_price: r.cost_price ?? "0",
        sell_price: r.sell_price ?? "0",
        stock_qty: r.stock_qty ?? "0",
        reorder_level: r.reorder_level ?? "5",
        active: r.active ?? "true",
        errors: [],
      };
      if (!row.name) row.errors.push("name required");
      if (!row.sku) row.errors.push("sku required");
      if (Number.isNaN(parseFloat(row.sell_price))) row.errors.push("sell_price not numeric");
      if (Number.isNaN(parseFloat(row.cost_price))) row.errors.push("cost_price not numeric");
      return row;
    });
    setRows(validated);
  };

  const downloadTemplate = () => {
    downloadCsv([
      {
        sku: "BEV-100",
        name: "Sample Drink 50cl",
        barcode: "",
        category: "Beverages",
        cost_price: "200",
        sell_price: "350",
        stock_qty: "20",
        reorder_level: "5",
        active: "true",
      },
    ], "products_template.csv");
  };

  const runImport = async () => {
    const valid = rows.filter((r) => r.errors.length === 0);
    if (!valid.length) { toast.error("No valid rows to import"); return; }
    setBusy(true);
    try {
      // Resolve / create categories by name
      const catNames = Array.from(new Set(valid.map((r) => r.category.trim()).filter(Boolean)));
      const catMap = new Map<string, string>();
      if (catNames.length) {
        const { data: existing } = await supabase
          .from("categories").select("id, name").in("name", catNames);
        (existing ?? []).forEach((c) => catMap.set(c.name.toLowerCase(), c.id));
        const missing = catNames.filter((n) => !catMap.has(n.toLowerCase()));
        if (missing.length) {
          const { data: created } = await supabase.from("categories")
            .insert(missing.map((name) => ({ name }))).select("id, name");
          (created ?? []).forEach((c) => catMap.set(c.name.toLowerCase(), c.id));
        }
      }

      const payload = valid.map((r) => ({
        sku: r.sku.trim(),
        name: r.name.trim(),
        barcode: r.barcode.trim() || null,
        category_id: r.category ? catMap.get(r.category.toLowerCase()) ?? null : null,
        cost_price_kobo: nairaToKobo(r.cost_price || "0"),
        sell_price_kobo: nairaToKobo(r.sell_price || "0"),
        stock_qty: parseInt(r.stock_qty || "0") || 0,
        reorder_level: parseInt(r.reorder_level || "0") || 0,
        active: !["false", "0", "no"].includes(r.active.toLowerCase()),
      }));

      // Chunked upsert
      let written = 0;
      const chunk = 200;
      for (let i = 0; i < payload.length; i += chunk) {
        const slice = payload.slice(i, i + chunk);
        const { error } = await supabase.from("products").upsert(slice, { onConflict: "sku" });
        if (error) throw error;
        written += slice.length;
      }

      toast.success(`Imported ${written} product${written === 1 ? "" : "s"}`);
      const skipped = rows.length - valid.length;
      if (skipped > 0) toast.warning(`${skipped} row${skipped === 1 ? "" : "s"} skipped due to errors`);
      onImported();
      setRows([]);
      setFilename("");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const errorCount = rows.length - validCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bulk import products</DialogTitle>
          <DialogDescription>
            Upload a CSV with columns: sku, name, barcode, category, cost_price, sell_price, stock_qty, reorder_level, active.
            Existing SKUs are updated; new ones are created.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" /> Download template
          </Button>
          <label className="inline-flex">
            <Input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <span className="inline-flex h-9 cursor-pointer items-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent">
              <Upload className="mr-2 h-4 w-4" /> {filename || "Choose CSV…"}
            </span>
          </label>
          {rows.length > 0 && (
            <div className="ml-auto flex gap-2">
              <Badge variant="secondary">{validCount} valid</Badge>
              {errorCount > 0 && <Badge variant="destructive">{errorCount} errors</Badge>}
            </div>
          )}
        </div>

        {rows.length > 0 && (
          <div className="max-h-80 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Sell</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 50).map((r, i) => (
                  <TableRow key={i} className={r.errors.length ? "bg-destructive/5" : ""}>
                    <TableCell className="font-mono text-xs">{r.sku}</TableCell>
                    <TableCell className="text-sm">{r.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.category}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{r.cost_price}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{r.sell_price}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{r.stock_qty}</TableCell>
                    <TableCell className="text-xs text-destructive">{r.errors.join(", ")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {rows.length > 50 && (
              <div className="border-t p-2 text-center text-xs text-muted-foreground">
                Showing first 50 of {rows.length} rows
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={runImport} disabled={busy || !validCount}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import {validCount > 0 ? `${validCount} row${validCount === 1 ? "" : "s"}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
