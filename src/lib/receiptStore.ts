import { supabase } from "@/integrations/supabase/client";

export interface ReceiptStore {
  store_name: string;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  receipt_footer: string | null;
}

/**
 * Fetch the receipt store info, preferring the active store from `stores`
 * and falling back to the legacy single-row `store_settings`.
 */
export async function fetchReceiptStore(): Promise<ReceiptStore> {
  const [storeRes, settingsRes] = await Promise.all([
    supabase
      .from("stores")
      .select("name,address,phone,logo_url")
      .eq("is_active", true)
      .maybeSingle(),
    supabase.from("store_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  const s = storeRes.data;
  const st = settingsRes.data;
  if (s) {
    return {
      store_name: s.name,
      address: s.address,
      phone: s.phone,
      logo_url: s.logo_url,
      receipt_footer: st?.receipt_footer ?? null,
    };
  }
  return {
    store_name: st?.store_name ?? "Store",
    address: st?.address ?? null,
    phone: st?.phone ?? null,
    logo_url: st?.logo_url ?? null,
    receipt_footer: st?.receipt_footer ?? null,
  };
}
