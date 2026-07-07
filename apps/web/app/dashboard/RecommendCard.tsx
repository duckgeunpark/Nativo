import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface RecommendCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  /** 남은 양 슬롯 — 항상 값을 채워 보낸다(0일 때도 "복습 완료" 등 문구로). */
  remaining: string;
  /** 추천 이유 슬롯 — 항상 값을 채워 보낸다. */
  reason: string;
  /** 이어보기 위치 슬롯 — 위치 추적이 있는 기능(쉐도잉/읽기)에서만 전달. */
  resume?: string;
  progress?: { value: number; max: number };
}

/** 홈 화면 최상단 hero 추천 카드 — CSV #5: 남은 양·이어보기 위치·추천 이유 슬롯. */
export function HeroRecommendCard({
  href,
  icon: Icon,
  title,
  remaining,
  reason,
  resume,
  progress,
}: RecommendCardProps) {
  return (
    <Link
      href={href}
      className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card className="overflow-hidden rounded-2xl border-primary/15 bg-primary text-primary-foreground transition-colors hover:bg-primary/95">
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="font-display text-xl font-bold sm:text-2xl">{title}</p>
                <p className="mt-1 text-sm text-primary-foreground/80">{reason}</p>
              </div>
            </div>
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-highlight text-highlight-foreground"
            >
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-primary-foreground/90">{remaining}</span>
            {resume && <span className="text-primary-foreground/70">{resume}</span>}
          </div>

          {progress && (
            <ProgressBar
              value={progress.value}
              max={progress.max}
              tone="highlight"
              aria-label={title}
              className="bg-primary-foreground/20"
            />
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

/** 홈 화면 보조 추천 카드 — 컴팩트한 리스트형. */
export function SecondaryRecommendCard({
  href,
  icon: Icon,
  title,
  remaining,
  reason,
  resume,
  progress,
  className,
}: RecommendCardProps & { className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      <Card className="h-full transition-colors hover:bg-secondary/50">
        <CardContent className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
            <Icon className="h-4.5 w-4.5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{title}</p>
            <p className="truncate text-xs text-muted-foreground">{remaining}</p>
            {progress && (
              <div className="mt-2 flex items-center gap-2">
                <ProgressBar value={progress.value} max={progress.max} className="h-1.5" />
                {resume && (
                  <span className="shrink-0 text-[11px] text-muted-foreground">{resume}</span>
                )}
              </div>
            )}
            <p className="mt-1 truncate text-[11px] text-muted-foreground">{reason}</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </CardContent>
      </Card>
    </Link>
  );
}
