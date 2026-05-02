import { forwardRef } from "react";
import { formatNaira } from "@/lib/money";
import { fmtDateTime } from "@/lib/dates";

export interface ReceiptItem {
  product_name: string;
  sku: string;
  quantity: number;
  unit_price_kobo: number;
  line_discount_kobo: number;
  line_total_kobo: number;
}

export interface ReceiptData {
  store_name: string;
  store_address?: string | null;
  store_phone?: string | null;
  store_logo_url?: string | null;
  receipt_footer?: string | null;
  sale_number: number | string;
  cashier_name: string;
  created_at: string;
  items: ReceiptItem[];
  subtotal_kobo: number;
  discount_kobo: number;
  total_kobo: number;
  payment_method: string;
  amount_tendered_kobo: number;
  change_kobo: number;
  status?: string;
}

export const Receipt = forwardRef<HTMLDivElement, { data: ReceiptData }>(({ data }, ref) => {
  return (
    <div id="print-receipt" ref={ref} className="mx-auto max-w-[80mm] bg-card p-4 font-mono text-xs text-foreground">
      <div className="text-center">
        {data.store_logo_url && (
          <img src={data.store_logo_url} alt={data.store_name}
            className="mx-auto mb-1 h-12 w-12 object-contain" />
        )}
        <div className="text-sm font-bold uppercase">{data.store_name}</div>
        {data.store_address && <div>{data.store_address}</div>}
        {data.store_phone && <div>Tel: {data.store_phone}</div>}
      </div>
      <div className="my-2 border-t border-dashed" />
      <div className="flex justify-between"><span>Sale #</span><span>{data.sale_number}</span></div>
      <div className="flex justify-between"><span>Date</span><span>{fmtDateTime(data.created_at)}</span></div>
      <div className="flex justify-between"><span>Cashier</span><span className="truncate">{data.cashier_name}</span></div>
      {data.status && data.status !== "completed" && (
        <div className="mt-1 text-center font-bold uppercase">[{data.status.replace("_", " ")}]</div>
      )}
      <div className="my-2 border-t border-dashed" />
      <div>
        {data.items.map((it, i) => (
          <div key={i} className="mb-1">
            <div className="truncate">{it.product_name}</div>
            <div className="flex justify-between tabular-nums">
              <span>{it.quantity} × {formatNaira(it.unit_price_kobo)}</span>
              <span>{formatNaira(it.line_total_kobo)}</span>
            </div>
            {it.line_discount_kobo > 0 && (
              <div className="flex justify-between tabular-nums text-muted-foreground">
                <span>  discount</span><span>-{formatNaira(it.line_discount_kobo)}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="my-2 border-t border-dashed" />
      <div className="space-y-0.5 tabular-nums">
        <div className="flex justify-between"><span>Subtotal</span><span>{formatNaira(data.subtotal_kobo)}</span></div>
        {data.discount_kobo > 0 && <div className="flex justify-between"><span>Discount</span><span>-{formatNaira(data.discount_kobo)}</span></div>}
        <div className="flex justify-between text-sm font-bold"><span>TOTAL</span><span>{formatNaira(data.total_kobo)}</span></div>
        <div className="flex justify-between"><span>Payment ({data.payment_method.replace("_", " ")})</span><span>{formatNaira(data.amount_tendered_kobo)}</span></div>
        {data.change_kobo > 0 && <div className="flex justify-between"><span>Change</span><span>{formatNaira(data.change_kobo)}</span></div>}
      </div>
      <div className="my-2 border-t border-dashed" />
      {data.receipt_footer && <div className="text-center">{data.receipt_footer}</div>}
    </div>
  );
});
Receipt.displayName = "Receipt";
