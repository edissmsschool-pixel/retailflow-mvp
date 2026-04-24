import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "default" | "primary" | "accent" | "success" | "warning" | "destructive";

export function StatTile({
  label, value, icon, sub, tone = "default",
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
}) {
  const iconBg: Record<Tone, string> = {
    default: "bg-muted text-muted-foreground",
    primary: "gradient-primary text-primary-foreground shadow-glow",
    accent: "gradient-accent text-accent-foreground shadow-glow",
    success: "gradient-success text-success-foreground",
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/10 text-destructive",
  };
  const ring: Record<Tone, string> = {
    default: "",
    primary: "ring-1 ring-primary/10",
    accent: "ring-1 ring-accent/15",
    success: "ring-1 ring-success/10",
    warning: "ring-1 ring-warning/20",
    destructive: "ring-1 ring-destructive/15",
  };
  return (
    <Card className={cn("glass overflow-hidden border-0 shadow-card hover-lift", ring[tone])}>
      <CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-1.5 truncate font-display text-2xl font-bold tabular-nums text-foreground sm:text-[28px]">
            {value}
          </div>
          {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
        </div>
        {icon && (
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", iconBg[tone])}>
            {icon}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
