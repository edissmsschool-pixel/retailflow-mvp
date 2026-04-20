import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Store } from "lucide-react";

export default function Auth() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [signInData, setSignInData] = useState({ email: "", password: "" });
  const [signUpData, setSignUpData] = useState({ email: "", password: "", full_name: "" });

  if (loading) return null;
  if (session) {
    const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname || "/";
    return <Navigate to={from} replace />;
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(signInData);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Welcome back");
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (signUpData.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: signUpData.email,
      password: signUpData.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: signUpData.full_name },
      },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Account created. You're signed in.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-primary text-primary-foreground shadow-elevated">
            <Store className="h-5 w-5" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Retail POS</h1>
        </div>
        <Card className="shadow-card">
          <CardHeader className="pb-4">
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Sign in to access the till. The first account becomes the admin.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="mt-4">
                <form onSubmit={handleSignIn} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="si-email">Email</Label>
                    <Input id="si-email" type="email" required autoComplete="email"
                      value={signInData.email}
                      onChange={(e) => setSignInData({ ...signInData, email: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="si-pass">Password</Label>
                    <Input id="si-pass" type="password" required autoComplete="current-password"
                      value={signInData.password}
                      onChange={(e) => setSignInData({ ...signInData, password: e.target.value })} />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Sign in
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup" className="mt-4">
                <form onSubmit={handleSignUp} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="su-name">Full name</Label>
                    <Input id="su-name" required value={signUpData.full_name}
                      onChange={(e) => setSignUpData({ ...signUpData, full_name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-email">Email</Label>
                    <Input id="su-email" type="email" required autoComplete="email"
                      value={signUpData.email}
                      onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-pass">Password (min 8 chars)</Label>
                    <Input id="su-pass" type="password" required minLength={8} autoComplete="new-password"
                      value={signUpData.password}
                      onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })} />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
