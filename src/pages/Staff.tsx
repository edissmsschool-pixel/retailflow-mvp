import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoreVertical, Plus, Trash2, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type Role = "admin" | "manager" | "cashier";

interface StaffRow {
  id: string; full_name: string; phone: string | null; active: boolean;
  user_roles: { role: Role }[];
}

export default function Staff() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<StaffRow | null>(null);
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
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delErr) return toast.error(delErr.message);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    qc.invalidateQueries({ queryKey: ["staff-list"] });
  };

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from("profiles").update({ active: !active }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(!active ? "User reactivated" : "User deactivated");
    qc.invalidateQueries({ queryKey: ["staff-list"] });
  };

  const deleteUser = async (s: StaffRow) => {
    const { data, error } = await supabase.functions.invoke("admin-delete-user", { body: { user_id: s.id } });
    setConfirmDelete(null);
    if (error || (data as { error?: string })?.error) {
      return toast.error((data as { error?: string })?.error ?? error?.message ?? "Delete failed");
    }
    toast.success("User permanently deleted");
    qc.invalidateQueries({ queryKey: ["staff-list"] });
  };

  return (
    <div className="container px-3 py-4 sm:px-6 sm:py-6">
      <PageHeader
        title="Staff"
        description="Create and manage user accounts and roles."
        actions={<Button className="w-full sm:w-auto" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Add staff</Button>}
      />

      <Card className="shadow-card">
        <CardContent className="p-3 sm:p-4">
          {/* Mobile: cards */}
          <div className="space-y-2 md:hidden">
            {staff.data?.map((s) => (
              <div key={s.id} className="rounded-xl border bg-card p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{s.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{s.phone ?? "—"}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {s.active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                      <Badge variant="outline" className="capitalize">{s.user_roles[0]?.role ?? "cashier"}</Badge>
                    </div>
                  </div>
                  <RowMenu
                    s={s}
                    isMe={s.id === me?.id}
                    onChangeRole={(r) => setRole(s.id, r)}
                    onToggle={() => toggleActive(s.id, s.active)}
                    onDelete={() => setConfirmDelete(s)}
                  />
                </div>
              </div>
            ))}
            {staff.data?.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">No staff yet.</div>
            )}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead className="w-12"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {staff.data?.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.full_name || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.phone ?? "—"}</TableCell>
                    <TableCell>
                      <Select value={s.user_roles[0]?.role ?? "cashier"} onValueChange={(v) => setRole(s.id, v as Role)}>
                        <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="cashier">Cashier</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{s.active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                    <TableCell className="text-right">
                      <RowMenu
                        s={s}
                        isMe={s.id === me?.id}
                        onChangeRole={(r) => setRole(s.id, r)}
                        onToggle={() => toggleActive(s.id, s.active)}
                        onDelete={() => setConfirmDelete(s)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {staff.data?.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No staff yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto">
          <DialogHeader><DialogTitle>Add staff</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Full name</Label><Input className="h-11" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input className="h-11" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input className="h-11" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Temporary password (8+ chars)</Label><Input className="h-11" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="cashier">Cashier</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="h-11 flex-1 sm:flex-none" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="h-11 flex-1 sm:flex-none" onClick={create}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{confirmDelete?.full_name}</strong> will be removed from the system. Their sign-in, roles and profile are deleted. Past sales remain in history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && deleteUser(confirmDelete)}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RowMenu({
  s, isMe, onChangeRole, onToggle, onDelete,
}: {
  s: StaffRow; isMe: boolean;
  onChangeRole: (r: Role) => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Row actions">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <div className="md:hidden">
          <DropdownMenuItem onSelect={() => onChangeRole("admin")}>Make admin</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onChangeRole("manager")}>Make manager</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onChangeRole("cashier")}>Make cashier</DropdownMenuItem>
          <DropdownMenuSeparator />
        </div>
        <DropdownMenuItem onSelect={onToggle}>
          {s.active ? <><UserX className="mr-2 h-4 w-4" />Deactivate</> : <><UserCheck className="mr-2 h-4 w-4" />Reactivate</>}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={onDelete}
          disabled={isMe}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />Delete permanently
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
