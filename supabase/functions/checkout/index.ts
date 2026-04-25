import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CartItem {
  product_id: string;
  quantity: number;
  line_discount_kobo?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const uid = userData.user.id;

    const body = await req.json();
    const items = body.items as CartItem[];
    const sale_discount_kobo = Math.max(0, Math.floor(body.sale_discount_kobo ?? 0));
    const payment_method = body.payment_method as "cash" | "transfer" | "pos_card";
    const amount_tendered_kobo = Math.max(0, Math.floor(body.amount_tendered_kobo ?? 0));
    const shift_id = body.shift_id ?? null;

    if (!Array.isArray(items) || items.length === 0) return json({ error: "Cart is empty" }, 400);
    if (!["cash", "transfer", "pos_card"].includes(payment_method))
      return json({ error: "Invalid payment method" }, 400);
    for (const it of items) {
      if (!it.product_id || !Number.isInteger(it.quantity) || it.quantity <= 0)
        return json({ error: "Invalid cart item" }, 400);
    }

    const admin = createClient(supabaseUrl, service);
    const { data, error } = await admin.rpc("process_checkout", {
      _cashier: uid,
      _items: items,
      _sale_discount_kobo: sale_discount_kobo,
      _payment_method: payment_method,
      _amount_tendered_kobo: amount_tendered_kobo,
      _shift_id: shift_id,
    });
    if (error) return json({ error: error.message }, 400);

    // Fire-and-forget notifications: new sale + low stock alerts
    (async () => {
      try {
        const { data: sale } = await admin
          .from("sales")
          .select("sale_number, total_kobo")
          .eq("id", data)
          .single();
        const total = ((sale?.total_kobo ?? 0) / 100).toLocaleString("en-NG", { style: "currency", currency: "NGN" });
        await admin.functions.invoke("send-push", {
          body: {
            title: "New sale completed",
            body: `Sale #${sale?.sale_number} — ${total}`,
            url: "/sales",
            roles: ["admin", "manager"],
          },
        });

        // Low stock check
        const productIds = items.map((i) => i.product_id);
        const { data: lowProds } = await admin
          .from("products")
          .select("name, stock_qty, reorder_level")
          .in("id", productIds);
        const low = (lowProds ?? []).filter((p) => p.stock_qty <= p.reorder_level);
        if (low.length) {
          await admin.functions.invoke("send-push", {
            body: {
              title: "Low stock alert",
              body: low.map((p) => `${p.name} (${p.stock_qty} left)`).join(", "),
              url: "/products",
              roles: ["admin", "manager"],
            },
          });
        }
      } catch (e) {
        console.error("notification dispatch failed", e);
      }
    })();

    return json({ sale_id: data });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
