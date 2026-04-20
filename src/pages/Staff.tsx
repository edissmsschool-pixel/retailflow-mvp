import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";

type Role = "admin" | "manager" | "cashier";

interface StaffRow {
  id: string; full_name: string; phone: string | null; active: boolean;
  user_roles: { role: Role }[];
}

export default function Staff() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", phone: "", role: "cashier" as Role });

  const staff = useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles")
        .select("id, full_name, phone, active, user_roles(role)").order("full_name");
      if (error) throw error;
      return data as unknown as StaffRow[];
    },
  });

  const create = async () => {
    if (!form.email || form.password.length < 8 || !form.full_name) {
      toast.error("Email, name, and 8+ char password required");
      return;
    }
    const { error } = await supabase.functions.invoke("admin-create-staff", { body: form });
    if (error) return toast.error(error.message);
    toast.success("Staff added");
    setOpen(false);
    setForm({ email: "", password: "", full_name: "", phone: "", role: "cashier" });
    qc.invalidateQueries({ queryKey: ["staff-list"] });
  };

  const setRole = async (userId: string, role: Role) => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    qc.invalidateQueries({ queryKey: ["staff-list"] });
  };

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from("profiles").update({ active: !active }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["staff-list"] });
  };

  return (
    <div className="container py-6">
      <PageHeader title="Staff" description="Create and manage user accounts and roles."
        actions={<Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Add staff</Button>} />
      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {staff.data?.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.full_name || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.phone ?? "—"}</TableCell>
                    <TableCell>
                      <Select value={s.user_roles[0]?.role ?? "cashier"} onValueChange={(v) => setRole(s.id, v as Role)}>
                        <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="cashier">Cashier</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{s.active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(s.id, s.active)}>
                        {s.active ? "Deactivate" : "Reactivate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add staff</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Temporary password (8+ chars)</Label><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="cashier">Cashier</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
