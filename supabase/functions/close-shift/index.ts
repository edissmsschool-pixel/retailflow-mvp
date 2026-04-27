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

    const body = await req.json();
    const shift_id = body.shift_id as string;
    const counted_cash_kobo = Math.max(0, Math.floor(Number(body.counted_cash_kobo ?? 0)));
    const notes = (body.notes as string) || "";
    const counted_breakdown = body.counted_breakdown ?? null;
    if (!shift_id) return json({ error: "Invalid request" }, 400);

    const admin = createClient(supabaseUrl, service);

    // Validate ownership or manager
    const { data: shift } = await admin.from("shifts").select("cashier_id").eq("id", shift_id).single();
    if (!shift) return json({ error: "Shift not found" }, 404);
    if (shift.cashier_id !== userData.user.id) {
      const { data: roleCheck } = await admin.rpc("is_manager_or_admin", { _user_id: userData.user.id });
      if (!roleCheck) return json({ error: "Forbidden" }, 403);
    }

    const { error } = await admin.rpc("close_shift", {
      _shift_id: shift_id,
      _counted_cash_kobo: counted_cash_kobo,
      _notes: notes,
      _counted_breakdown: counted_breakdown,
    });
    if (error) return json({ error: error.message }, 400);
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
