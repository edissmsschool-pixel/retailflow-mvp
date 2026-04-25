import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: "Unauthorized" }, 401);
    const uid = userData.user.id;

    const admin = createClient(supabaseUrl, service);
    const { data: roleCheck } = await admin.rpc("is_manager_or_admin", { _user_id: uid });
    if (!roleCheck) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const product_id = body.product_id as string;
    const change_qty = Number(body.change_qty);
    const reason = (body.reason as string) || "Adjustment";
    if (!product_id || !Number.isInteger(change_qty) || change_qty === 0)
      return json({ error: "Invalid request" }, 400);

    const { error } = await admin.rpc("adjust_stock", {
      _product_id: product_id,
      _change_qty: change_qty,
      _reason: reason,
      _performed_by: uid,
    });
    if (error) return json({ error: error.message }, 400);

    // Low-stock notification
    (async () => {
      try {
        const { data: p } = await admin
          .from("products")
          .select("name, stock_qty, reorder_level")
          .eq("id", product_id)
          .single();
        if (p && p.stock_qty <= p.reorder_level) {
          await admin.functions.invoke("send-push", {
            body: {
              title: "Low stock alert",
              body: `${p.name} (${p.stock_qty} left)`,
              url: "/products",
              roles: ["admin", "manager"],
            },
          });
        }
      } catch (e) {
        console.error("notification dispatch failed", e);
      }
    })();

    return json({ ok: true });
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
