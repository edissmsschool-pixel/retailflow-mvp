// Identify a product from an image using Lovable AI vision.
// Receives an image (base64) plus a candidate list and returns the best match.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Candidate {
  id: string;
  name: string;
  sku: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image_base64, candidates } = (await req.json()) as {
      image_base64?: string;
      candidates?: Candidate[];
    };

    if (!image_base64 || !candidates?.length) {
      return new Response(
        JSON.stringify({ error: "image_base64 and candidates are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalise candidate list to keep prompt small.
    const list = candidates.slice(0, 200).map((c) => ({
      id: c.id,
      name: c.name,
      sku: c.sku,
    }));

    const dataUrl = image_base64.startsWith("data:")
      ? image_base64
      : `data:image/jpeg;base64,${image_base64}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You identify retail products from a photo. You will be given a list of candidate products (id, name, sku) and an image. Return the single best matching product id, or null if no candidate matches with reasonable confidence.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Candidates JSON:\n${JSON.stringify(list)}\n\nReturn the matching product id from the candidates only.`,
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_match",
              description: "Report the best-matching product.",
              parameters: {
                type: "object",
                properties: {
                  product_id: {
                    type: ["string", "null"],
                    description: "Matching product id from the candidates, or null.",
                  },
                  confidence: {
                    type: "number",
                    description: "Confidence between 0 and 1.",
                  },
                  reasoning: { type: "string" },
                },
                required: ["product_id", "confidence"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_match" } },
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      console.error("AI gateway error", aiRes.status, text);
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit reached. Try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "AI request failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = await aiRes.json();
    const call = payload?.choices?.[0]?.message?.tool_calls?.[0];
    let product_id: string | null = null;
    let confidence = 0;
    if (call?.function?.arguments) {
      try {
        const args = JSON.parse(call.function.arguments);
        product_id = args.product_id ?? null;
        confidence = typeof args.confidence === "number" ? args.confidence : 0;
      } catch {
        /* noop */
      }
    }

    return new Response(
      JSON.stringify({ product_id, confidence }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
