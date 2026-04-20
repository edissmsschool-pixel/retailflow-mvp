import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatTile({
  label, value, icon, sub, tone = "default",
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "primary" | "success" | "warning" | "destructive";
}) {
  const toneMap: Record<string, string> = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/10 text-destructive",
  };
  return (
    <Card className="shadow-card">
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-1 truncate font-display text-2xl font-bold tabular-nums text-foreground">{value}</div>
          {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
        </div>
        {icon && <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", toneMap[tone])}>{icon}</div>}
      </CardContent>
    </Card>
  );
}
