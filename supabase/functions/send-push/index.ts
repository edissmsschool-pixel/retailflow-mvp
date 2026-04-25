// Send Web Push notifications using VAPID.
// Internal helper invoked by other edge functions. Service-role only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC = "BJ5CqkOc06gf55DbaEdb8o9iYvyTEHrWWXo2bot5QA9MMKqe0to6IRnJklbP1dwEhspagTjyRpbhbcKe7YplFsU";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")
  ?? "CP8gFEGAMfIqGiEUQahSTFismNHH_-_jlb44Y-nheLc";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@perepiri.local";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

interface SendBody {
  title: string;
  body: string;
  url?: string;
  user_ids?: string[];
  roles?: ("admin" | "manager" | "cashier")[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, service);

    const payload = (await req.json()) as SendBody;
    if (!payload.title || !payload.body) return json({ error: "title and body required" }, 400);

    let userIds: string[] = payload.user_ids ?? [];
    if (payload.roles?.length) {
      const { data: roleRows } = await admin.from("user_roles").select("user_id, role").in("role", payload.roles);
      userIds = Array.from(new Set([...userIds, ...(roleRows ?? []).map((r) => r.user_id)]));
    }
    if (!userIds.length) return json({ ok: true, sent: 0 });

    const { data: subs } = await admin.from("push_subscriptions").select("*").in("user_id", userIds);
    if (!subs?.length) return json({ ok: true, sent: 0 });

    const message = JSON.stringify({ title: payload.title, body: payload.body, url: payload.url ?? "/" });
    const stale: string[] = [];
    let sent = 0;

    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          message
        );
        sent++;
      } catch (err: any) {
        const code = err?.statusCode;
        if (code === 404 || code === 410) stale.push(s.endpoint);
        else console.error("push send failed", code, err?.body);
      }
    }));

    if (stale.length) {
      await admin.from("push_subscriptions").delete().in("endpoint", stale);
    }

    return json({ ok: true, sent });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
