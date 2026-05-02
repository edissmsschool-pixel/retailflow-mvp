import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { getIdleMinutes, setIdleMinutes } from "@/components/IdleLock";

export function IdleLockSettings() {
  const [mins, setMins] = useState<number>(5);
  useEffect(() => { setMins(getIdleMinutes()); }, []);

  const save = () => {
    if (!Number.isFinite(mins) || mins < 1 || mins > 120) {
      return toast.error("Choose between 1 and 120 minutes");
    }
    setIdleMinutes(mins);
    toast.success(`Lock screen after ${mins} min idle`);
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-4 w-4" /> Idle lock screen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Automatically lock this device after a period of inactivity. Re-enter your password to unlock.
        </p>
        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="idle-mins">Idle minutes</Label>
            <Input id="idle-mins" type="number" min={1} max={120} className="w-32"
              value={mins} onChange={(e) => setMins(Number(e.target.value))} />
          </div>
          <Button onClick={save}>Save</Button>
        </div>
      </CardContent>
    </Card>
  );
}
