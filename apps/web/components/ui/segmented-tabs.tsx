"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentedTabOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

/**
 * 세그먼트 탭 — 허브 화면의 하위 기능 전환용 (CSV #6: active/hover/focus/disabled + 키보드 이동)
 * 균등 분배 grid라 모바일에서 가로 스크롤이 생기지 않는다.
 */
export function SegmentedTabs({
  value,
  onValueChange,
  options,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SegmentedTabOption[];
  className?: string;
  "aria-label"?: string;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const enabledIndexes = options
    .map((o, i) => (o.disabled ? -1 : i))
    .filter((i) => i >= 0);

  function focusAt(index: number) {
    refs.current[index]?.focus();
    const opt = options[index];
    if (opt && !opt.disabled) onValueChange(opt.value);
  }

  function onKeyDown(e: React.KeyboardEvent, current: number) {
    if (enabledIndexes.length === 0) return;
    const pos = enabledIndexes.indexOf(current);
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      next = enabledIndexes[(pos + 1) % enabledIndexes.length] ?? null;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      next = enabledIndexes[(pos - 1 + enabledIndexes.length) % enabledIndexes.length] ?? null;
    } else if (e.key === "Home") {
      next = enabledIndexes[0] ?? null;
    } else if (e.key === "End") {
      next = enabledIndexes[enabledIndexes.length - 1] ?? null;
    }
    if (next !== null) {
      e.preventDefault();
      focusAt(next);
    }
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-secondary p-1",
        className,
      )}
    >
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={opt.disabled}
            tabIndex={active ? 0 : -1}
            onClick={() => onValueChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "min-w-0 truncate rounded-full px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-primary font-medium text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              opt.disabled && "pointer-events-none opacity-50",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
