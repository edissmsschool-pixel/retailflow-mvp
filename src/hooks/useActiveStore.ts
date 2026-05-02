import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ActiveStore {
  id?: string;
  name: string;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  receipt_footer: string | null;
}

/**
 * Returns the currently active store, falling back to legacy single-row
 * `store_settings` if no store row is marked active.
 */
export function useActiveStore() {
  return useQuery({
    queryKey: ["active-store"],
    staleTime: 60_000,
    queryFn: async (): Promise<ActiveStore> => {
      const [storeRes, settingsRes] = await Promise.all([
        supabase
          .from("stores")
          .select("id,name,address,phone,logo_url")
          .eq("is_active", true)
          .maybeSingle(),
        supabase.from("store_settings").select("*").eq("id", 1).maybeSingle(),
      ]);
      const s = storeRes.data;
      const settings = settingsRes.data;
      if (s) {
        return {
          id: s.id,
          name: s.name,
          address: s.address,
          phone: s.phone,
          logo_url: s.logo_url,
          receipt_footer: settings?.receipt_footer ?? null,
        };
      }
      return {
        name: settings?.store_name ?? "My Store",
        address: settings?.address ?? null,
        phone: settings?.phone ?? null,
        logo_url: settings?.logo_url ?? null,
        receipt_footer: settings?.receipt_footer ?? null,
      };
    },
  });
}
