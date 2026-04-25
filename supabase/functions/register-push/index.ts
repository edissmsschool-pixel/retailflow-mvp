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
    const { data: u, error: ue } = await userClient.auth.getUser();
    if (ue || !u.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const admin = createClient(supabaseUrl, service);

    if (body.unsubscribe) {
      if (!body.endpoint) return json({ error: "endpoint required" }, 400);
      await admin.from("push_subscriptions").delete()
        .eq("user_id", u.user.id).eq("endpoint", body.endpoint);
      return json({ ok: true });
    }

    const { endpoint, p256dh, auth, user_agent } = body;
    if (!endpoint || !p256dh || !auth) return json({ error: "endpoint, p256dh, auth required" }, 400);

    // Upsert by endpoint
    await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
    const { error } = await admin.from("push_subscriptions").insert({
      user_id: u.user.id,
      endpoint, p256dh, auth, user_agent: user_agent ?? null,
    });
    if (error) return json({ error: error.message }, 400);

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
