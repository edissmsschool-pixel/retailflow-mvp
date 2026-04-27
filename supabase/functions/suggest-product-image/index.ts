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
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI not configured" }, 500);

    const userClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => null);
    const name = String(body?.name ?? "").trim();
    if (!name || name.length > 200) return json({ error: "Invalid name" }, 400);

    // Ask AI for a public image URL of the product
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You help a Nigerian retail POS find product photos. Given a product name, return ONE direct public image URL (jpg, jpeg, png, or webp). Prefer common, recognisable retail product photos. Use Wikipedia, Wikimedia Commons, or unsplash.com. Never return a search results page. Never return a placeholder.",
          },
          { role: "user", content: `Product name: ${name}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "set_image",
              description: "Return the chosen product image URL.",
              parameters: {
                type: "object",
                properties: {
                  image_url: { type: "string", description: "Direct image URL ending in .jpg/.jpeg/.png/.webp" },
                  source: { type: "string", description: "Where the image is from" },
                },
                required: ["image_url"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "set_image" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      if (aiResp.status === 429) return json({ error: "AI rate limit, try again shortly" }, 429);
      if (aiResp.status === 402) return json({ error: "AI credits exhausted" }, 402);
      return json({ error: "AI failed" }, 500);
    }
    const aiJson = await aiResp.json();
    const args = aiJson?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return json({ error: "AI returned no image" }, 502);
    const parsed = JSON.parse(args) as { image_url?: string; source?: string };
    const url = parsed.image_url?.trim();
    if (!url || !/^https?:\/\//i.test(url)) return json({ error: "Invalid image URL" }, 502);

    // Fetch image server-side
    const imgResp = await fetch(url, {
      headers: { "User-Agent": "PerepiriPOS/1.0 (+suggest-product-image)" },
    });
    if (!imgResp.ok) return json({ error: `Could not fetch image (${imgResp.status})` }, 502);
    const ct = imgResp.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) return json({ error: "URL is not an image" }, 502);
    const buf = new Uint8Array(await imgResp.arrayBuffer());
    if (buf.byteLength > 6 * 1024 * 1024) return json({ error: "Image too large" }, 502);

    // Pick extension from content type
    const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";

    const admin = createClient(supabaseUrl, service);
    const path = `ai/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage.from("product-images").upload(path, buf, {
      contentType: ct,
      upsert: true,
    });
    if (upErr) return json({ error: upErr.message }, 500);
    const pub = admin.storage.from("product-images").getPublicUrl(path);

    return json({ image_url: pub.data.publicUrl, source: parsed.source ?? null });
  } catch (e) {
    console.error("suggest-product-image error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
