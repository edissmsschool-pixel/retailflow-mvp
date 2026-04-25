import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Bell, Loader2 } from "lucide-react";
import { pushSupported, getCurrentSubscription, enablePush, disablePush } from "@/lib/push";

export default function Settings() {
  const [form, setForm] = useState({ store_name: "", address: "", phone: "", receipt_footer: "" });
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const supported = pushSupported();

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

  useEffect(() => {
    if (!supported) return;
    getCurrentSubscription().then((s) => setPushOn(!!s));
  }, [supported]);

  const save = async () => {
    const { error } = await supabase.from("store_settings").update(form).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
  };

  const togglePush = async (on: boolean) => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (on) {
        await enablePush();
        setPushOn(true);
        toast.success("Push notifications enabled");
      } else {
        await disablePush();
        setPushOn(false);
        toast.success("Push notifications disabled");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Could not change notification setting");
    } finally {
      setPushBusy(false);
    }
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

      <Card className="mt-6 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" /> Push notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!supported ? (
            <p className="text-sm text-muted-foreground">
              Your browser doesn't support push notifications. Try Chrome, Edge, or install this app to your home screen on iOS 16.4+.
            </p>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Alert this device</p>
                <p className="text-xs text-muted-foreground">
                  Get notified about new sales and low-stock items, even when the app is closed.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {pushBusy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Switch checked={pushOn} disabled={pushBusy} onCheckedChange={togglePush} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
