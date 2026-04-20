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

    const admin = createClient(supabaseUrl, service);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const full_name = String(body.full_name || "").trim();
    const phone = body.phone ? String(body.phone).trim() : null;
    const role = body.role as "admin" | "manager" | "cashier";

    if (!email || !password || password.length < 8 || !full_name || !["admin", "manager", "cashier"].includes(role))
      return json({ error: "Invalid input" }, 400);

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone },
    });
    if (createErr || !created.user) return json({ error: createErr?.message || "Could not create user" }, 400);

    // Trigger seeded a 'cashier' role by default — replace with requested role.
    await admin.from("user_roles").delete().eq("user_id", created.user.id);
    const { error: roleErr } = await admin.from("user_roles").insert({ user_id: created.user.id, role });
    if (roleErr) return json({ error: roleErr.message }, 400);

    await admin.from("profiles").update({ full_name, phone }).eq("id", created.user.id);

    return json({ user_id: created.user.id });
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
