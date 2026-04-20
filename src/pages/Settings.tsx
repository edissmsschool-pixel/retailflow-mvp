import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function Settings() {
  const [form, setForm] = useState({ store_name: "", address: "", phone: "", receipt_footer: "" });

  const settings = useQuery({
    queryKey: ["store-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("store_settings").select("*").eq("id", 1).single();
      return data;
    },
  });

  useEffect(() => {
    if (settings.data) {
      setForm({
        store_name: settings.data.store_name ?? "",
        address: settings.data.address ?? "",
        phone: settings.data.phone ?? "",
        receipt_footer: settings.data.receipt_footer ?? "",
      });
    }
  }, [settings.data]);

  const save = async () => {
    const { error } = await supabase.from("store_settings").update(form).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
  };

  return (
    <div className="container max-w-2xl py-6">
      <PageHeader title="Store Settings" description="These appear on every receipt." />
      <Card className="shadow-card">
        <CardContent className="space-y-4 p-6">
          <div className="space-y-1.5"><Label>Store name</Label><Input value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Receipt footer</Label><Textarea value={form.receipt_footer} onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })} /></div>
          <div className="text-xs text-muted-foreground">Currency is fixed to Naira (₦). No tax.</div>
          <Button onClick={save}>Save settings</Button>
        </CardContent>
      </Card>
    </div>
  );
}
