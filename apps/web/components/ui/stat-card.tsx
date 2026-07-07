import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * 통계 수치 카드 — 숫자 길이가 달라도 카드가 밀리지 않게 tabular-nums 적용 (CSV #18)
 */
export function StatCard({
  label,
  value,
  sub,
  icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardContent className="flex flex-col gap-1.5 p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon && <span aria-hidden>{icon}</span>}
          <span className="truncate">{label}</span>
        </div>
        <p className="truncate text-2xl font-semibold tabular-nums">{value}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
