import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "idle-lock-minutes";
const LOCKED_KEY = "idle-lock-engaged";
const DEFAULT_MINUTES = 5;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"];

export function getIdleMinutes(): number {
  const v = Number(localStorage.getItem(STORAGE_KEY));
  if (Number.isFinite(v) && v > 0) return v;
  return DEFAULT_MINUTES;
}
export function setIdleMinutes(n: number) {
  localStorage.setItem(STORAGE_KEY, String(Math.max(1, Math.floor(n))));
  window.dispatchEvent(new Event("idle-lock-config"));
}

export function IdleLock() {
  const { user, signOut } = useAuth();
  const [locked, setLocked] = useState<boolean>(() => sessionStorage.getItem(LOCKED_KEY) === "1");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<number | null>(null);
  const minutesRef = useRef<number>(getIdleMinutes());

  const lock = useCallback(() => {
    sessionStorage.setItem(LOCKED_KEY, "1");
    setLocked(true);
  }, []);

  const reset = useCallback(() => {
    if (!user) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(lock, minutesRef.current * 60 * 1000);
  }, [user, lock]);

  useEffect(() => {
    const onCfg = () => { minutesRef.current = getIdleMinutes(); reset(); };
    window.addEventListener("idle-lock-config", onCfg);
    return () => window.removeEventListener("idle-lock-config", onCfg);
  }, [reset]);

  useEffect(() => {
    if (!user || locked) {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      return;
    }
    const handler = () => reset();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    document.addEventListener("visibilitychange", handler);
    reset();
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, handler));
      document.removeEventListener("visibilitychange", handler);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [user, locked, reset]);

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !password) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
      if (error) throw error;
      sessionStorage.removeItem(LOCKED_KEY);
      setLocked(false);
      setPassword("");
      toast.success("Welcome back");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Wrong password");
    } finally {
      setBusy(false);
    }
  };

  if (!user || !locked) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-md p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full gradient-primary text-primary-foreground shadow-glow">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="text-center text-xl font-bold">Session locked</h2>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Enter your password to continue.
        </p>
        <p className="mt-2 truncate text-center text-xs font-medium">{user.email}</p>

        <form onSubmit={unlock} className="mt-5 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="lock-pw">Password</Label>
            <Input
              id="lock-pw"
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy || !password}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
            Unlock
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={async () => {
              sessionStorage.removeItem(LOCKED_KEY);
              setLocked(false);
              await signOut();
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out instead
          </Button>
        </form>
      </div>
    </div>
  );
}
