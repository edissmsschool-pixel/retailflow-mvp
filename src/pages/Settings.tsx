import { useEffect, useRef, useState } from "react";
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
import { Bell, Loader2, Upload, Trash2, ImageIcon, ShieldCheck } from "lucide-react";
import { pushSupported, getCurrentSubscription, enablePush, disablePush } from "@/lib/push";
import { StoresManager } from "@/components/settings/StoresManager";
import { IdleLockSettings } from "@/components/settings/IdleLockSettings";
import { useAuth } from "@/contexts/AuthContext";

export default function Settings() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [form, setForm] = useState({ store_name: "", address: "", phone: "", receipt_footer: "", logo_url: "", signups_enabled: true });
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingSignups, setSavingSignups] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
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
        logo_url: settings.data.logo_url ?? "",
        signups_enabled: (settings.data as { signups_enabled?: boolean }).signups_enabled ?? true,
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

  const uploadLogo = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (file.size > 3 * 1024 * 1024) return toast.error("Image must be under 3MB");
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("store-assets").upload(path, file, {
        contentType: file.type,
        upsert: true,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("store-assets").getPublicUrl(path);
      const url = data.publicUrl;
      const { error: dbErr } = await supabase.from("store_settings").update({ logo_url: url }).eq("id", 1);
      if (dbErr) throw dbErr;
      setForm((f) => ({ ...f, logo_url: url }));
      toast.success("Logo updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Logo upload failed");
    } finally {
      setUploadingLogo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeLogo = async () => {
    const { error } = await supabase.from("store_settings").update({ logo_url: null }).eq("id", 1);
    if (error) return toast.error(error.message);
    setForm((f) => ({ ...f, logo_url: "" }));
    toast.success("Logo removed");
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not change notification setting";
      toast.error(msg);
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <div className="container max-w-2xl px-3 py-4 sm:px-6 sm:py-6">
      <PageHeader title="Store Settings" description="These appear on every receipt." />

      <Card className="shadow-card">
        <CardContent className="space-y-4 p-4 sm:p-6">
          {/* Logo */}
          <div className="space-y-2">
            <Label>Store logo</Label>
            <div className="flex flex-wrap items-center gap-3">
              <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted/40">
                {form.logo_url ? (
                  <img src={form.logo_url} alt="Store logo" className="h-full w-full object-contain" />
                ) : (
                  <ImageIcon className="h-7 w-7 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingLogo}
                >
                  {uploadingLogo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {form.logo_url ? "Replace logo" : "Upload logo"}
                </Button>
                {form.logo_url && (
                  <Button type="button" variant="ghost" onClick={removeLogo}>
                    <Trash2 className="mr-2 h-4 w-4" />Remove
                  </Button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadLogo(f);
                  }}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">PNG/JPG, square, under 3MB. Shown on receipts &amp; reports.</p>
          </div>

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

      <div className="mt-6">
        <StoresManager />
      </div>

      <div className="mt-6">
        <IdleLockSettings />
      </div>
    </div>
  );
}

