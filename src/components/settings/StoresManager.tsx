import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Store, Plus, Pencil, Trash2, CheckCircle2, ImageIcon, Upload, Loader2 } from "lucide-react";

interface StoreRow {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  is_active: boolean;
}

const empty = { name: "", address: "", phone: "", logo_url: "" };

export function StoresManager() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StoreRow | null>(null);
  const [form, setForm] = useState(empty);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const stores = useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as StoreRow[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["stores"] });
    qc.invalidateQueries({ queryKey: ["active-store"] });
  };

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (s: StoreRow) => {
    setEditing(s);
    setForm({ name: s.name, address: s.address ?? "", phone: s.phone ?? "", logo_url: s.logo_url ?? "" });
    setOpen(true);
  };

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image");
    if (file.size > 3 * 1024 * 1024) return toast.error("Image must be under 3MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `store-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("store-assets").upload(path, file, {
        contentType: file.type, upsert: true,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("store-assets").getPublicUrl(path);
      setForm((f) => ({ ...f, logo_url: data.publicUrl }));
      toast.success("Logo uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Store name is required");
    const payload = {
      name: form.name.trim(),
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      logo_url: form.logo_url || null,
    };
    if (editing) {
      const { error } = await supabase.from("stores").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Store updated");
    } else {
      const isFirst = (stores.data?.length ?? 0) === 0;
      const { error } = await supabase.from("stores").insert({ ...payload, is_active: isFirst });
      if (error) return toast.error(error.message);
      toast.success("Store added");
    }
    setOpen(false);
    refresh();
  };

  const setActive = async (id: string) => {
    // Unset previous active first to satisfy partial unique index.
    const { error: e1 } = await supabase.from("stores").update({ is_active: false }).eq("is_active", true);
    if (e1) return toast.error(e1.message);
    const { error: e2 } = await supabase.from("stores").update({ is_active: true }).eq("id", id);
    if (e2) return toast.error(e2.message);
    toast.success("Active store changed");
    refresh();
  };

  const remove = async (s: StoreRow) => {
    if (!confirm(`Delete "${s.name}"?`)) return;
    const { error } = await supabase.from("stores").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Store deleted");
    refresh();
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Store className="h-4 w-4" /> Stores
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" />Add store</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit store" : "Add store"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted/40">
                  {form.logo_url
                    ? <img src={form.logo_url} alt="Logo" className="h-full w-full object-contain" />
                    : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
                </div>
                <Button type="button" variant="outline" size="sm"
                  onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {form.logo_url ? "Replace logo" : "Upload logo"}
                </Button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
              </div>
              <div className="space-y-1.5"><Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save}>{editing ? "Save changes" : "Add store"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {stores.isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (stores.data?.length ?? 0) === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No stores yet. Add your first store to manage multiple locations.
          </div>
        ) : (
          <ul className="divide-y">
            {stores.data!.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted/40">
                  {s.logo_url
                    ? <img src={s.logo_url} alt={s.name} className="h-full w-full object-contain" />
                    : <Store className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{s.name}</span>
                    {s.is_active && (
                      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-600">
                        Active
                      </Badge>
                    )}
                  </div>
                  {(s.address || s.phone) && (
                    <div className="truncate text-xs text-muted-foreground">
                      {[s.address, s.phone].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!s.is_active && (
                    <Button size="sm" variant="ghost" onClick={() => setActive(s.id)} title="Set active">
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => openEdit(s)} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(s)}
                    className="text-destructive hover:text-destructive" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
