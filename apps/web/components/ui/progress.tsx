import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 진행 바 — 0%/100%/이상값(NaN, max<=0, 초과) 방어 포함 (CSV #18)
 * tone: primary(기본 진행) / highlight(코랄 — 오늘의 진행·스트릭 등 강조) / success(완료)
 */
export function ProgressBar({
  value,
  max = 100,
  tone = "primary",
  className,
  "aria-label": ariaLabel,
}: {
  value: number;
  max?: number;
  tone?: "primary" | "highlight" | "success";
  className?: string;
  "aria-label"?: string;
}) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const safeValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), safeMax) : 0;
  const percent = (safeValue / safeMax) * 100;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={safeValue}
      aria-label={ariaLabel}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-secondary", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300",
          tone === "primary" && "bg-primary",
          tone === "highlight" && "bg-highlight",
          tone === "success" && "bg-success",
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
