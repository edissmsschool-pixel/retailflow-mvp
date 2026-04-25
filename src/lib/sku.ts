import { supabase } from "@/integrations/supabase/client";

/**
 * Generate the next SKU for a category.
 * Format: <PREFIX>-<SEQ> e.g. BEV-014
 * Falls back to GEN if no category prefix is provided.
 * Uses the public.next_sku() Postgres function for race-safety.
 */
export async function generateSku(categoryName: string | null | undefined): Promise<string> {
  const raw = (categoryName ?? "GEN").trim();
  const prefix = raw
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 3)
    .toUpperCase() || "GEN";

  const { data, error } = await supabase.rpc("next_sku", { _prefix: prefix });
  if (error || !data) {
    // Fallback: random suffix so we never block creation
    const rand = Math.floor(Math.random() * 900 + 100);
    return `${prefix}-${rand}`;
  }
  return data as string;
}

/** Build a variant SKU from a base. */
export function variantSku(baseSku: string, index: number): string {
  return `${baseSku}-V${index}`;
}
