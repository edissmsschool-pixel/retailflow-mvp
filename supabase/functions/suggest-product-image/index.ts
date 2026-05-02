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
    const category = String(body?.category ?? "").trim();
    const brand = String(body?.brand ?? "").trim();
    if (!name || name.length > 200) return json({ error: "Invalid name" }, 400);

    // Step 1: refine the product description for higher precision.
    // Ask the model to expand the raw POS name into a precise, unambiguous
    // product descriptor (brand, variant, packaging, size) suited for a
    // Nigerian retail context.
    const refineResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You normalise messy Nigerian retail product names into precise product descriptors for image generation. Identify the most likely brand, variant, packaging (bottle/can/sachet/pack), size, and colour. Be concrete. If the name is ambiguous, pick the most common Nigerian SKU. Never invent fictional brands.",
          },
          {
            role: "user",
            content: `Raw name: "${name}"${brand ? `\nKnown brand: ${brand}` : ""}${category ? `\nCategory: ${category}` : ""}\nReturn the refined descriptor.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "refine_product",
              description: "Return a structured, precise product descriptor.",
              parameters: {
                type: "object",
                properties: {
                  descriptor: {
                    type: "string",
                    description:
                      "One sentence: brand + product + variant + packaging + size, e.g. 'Coca-Cola Original Taste 50cl PET bottle'",
                  },
                  packaging: { type: "string", description: "bottle, can, sachet, pack, box, bag, jar, tube, none" },
                  dominant_colors: {
                    type: "array",
                    items: { type: "string" },
                    description: "1-3 dominant colours of the packaging",
                  },
                  shot_type: {
                    type: "string",
                    enum: ["product_pack", "fresh_produce", "prepared_food", "apparel", "electronics", "generic"],
                  },
                },
                required: ["descriptor", "shot_type"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "refine_product" } },
      }),
    });

    if (!refineResp.ok) {
      const t = await refineResp.text();
      console.error("Refine error", refineResp.status, t);
      if (refineResp.status === 429) return json({ error: "AI rate limit, try again shortly" }, 429);
      if (refineResp.status === 402) return json({ error: "AI credits exhausted" }, 402);
      return json({ error: "AI refine failed", fallback: true }, 200);
    }
    const refineJson = await refineResp.json();
    const refineArgs = refineJson?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let descriptor = name;
    let packaging = "";
    let colors: string[] = [];
    let shot: string = "generic";
    if (refineArgs) {
      try {
        const r = JSON.parse(refineArgs);
        descriptor = (r.descriptor as string)?.trim() || name;
        packaging = (r.packaging as string) ?? "";
        colors = Array.isArray(r.dominant_colors) ? r.dominant_colors.slice(0, 3) : [];
        shot = (r.shot_type as string) ?? "generic";
      } catch {
        // keep defaults
      }
    }
    console.log("Refined product:", { descriptor, packaging, colors, shot });

    // Step 2: build a precise studio prompt and generate the image.
    const styleByShot: Record<string, string> = {
      product_pack:
        "professional studio product photography, packshot, perfectly centred, label clearly readable, soft even lighting, sharp focus",
      fresh_produce:
        "fresh produce, natural daylight, crisp focus, vibrant natural colours",
      prepared_food:
        "appetising food photography, top-down or 45-degree angle, soft daylight",
      apparel:
        "flat lay apparel photography, neatly arranged, true-to-life colours",
      electronics:
        "consumer electronics product shot, three-quarter angle, glossy finish, soft studio lighting",
      generic:
        "clean product photo, soft studio lighting, sharp focus",
    };
    const colorHint = colors.length ? `Dominant packaging colours: ${colors.join(", ")}.` : "";
    const packHint = packaging ? `Packaging: ${packaging}.` : "";

    // Request a cut-out PNG with a transparent background (similar to the
    // "transparent PNG" results you find via Google image search).
    const imagePrompt = [
      `High-resolution product cut-out of: ${descriptor}.`,
      packHint,
      colorHint,
      styleByShot[shot] ?? styleByShot.generic,
      "Isolated subject on a fully transparent background (alpha channel), no backdrop, no shadow on a surface, clean edges suitable for compositing.",
      "Output a PNG with transparency. Single product only. No text overlays, no watermarks, no extra props, no people, no hands. Square 1:1 framing.",
    ]
      .filter(Boolean)
      .join(" ");

    const genResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: imagePrompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!genResp.ok) {
      const t = await genResp.text();
      console.error("Image gen error", genResp.status, t);
      if (genResp.status === 429) return json({ error: "AI rate limit, try again shortly" }, 429);
      if (genResp.status === 402) return json({ error: "AI credits exhausted" }, 402);
      return json({ error: "AI image generation failed", fallback: true }, 200);
    }
    const genJson = await genResp.json();
    // Lovable AI image gen returns the image as a data URL inside images[0].image_url.url
    const imageDataUrl: string | undefined =
      genJson?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
      console.error("No image returned", JSON.stringify(genJson).slice(0, 500));
      return json({ error: "No image returned", fallback: true }, 200);
    }

    // Decode the data URL.
    const m = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!m) return json({ error: "Bad image payload", fallback: true }, 200);
    const ct = m[1];
    const bin = atob(m[2]);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    if (buf.byteLength > 6 * 1024 * 1024) {
      return json({ error: "Image too large", fallback: true }, 200);
    }
    const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";

    const admin = createClient(supabaseUrl, service);
    const path = `ai/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage.from("product-images").upload(path, buf, {
      contentType: ct,
      upsert: true,
    });
    if (upErr) return json({ error: upErr.message }, 500);
    const pub = admin.storage.from("product-images").getPublicUrl(path);

    return json({
      image_url: pub.data.publicUrl,
      source: "ai-generated",
      descriptor,
    });
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
