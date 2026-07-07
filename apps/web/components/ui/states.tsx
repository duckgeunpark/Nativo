/**
 * 공통 상태 표시 컴포넌트 — 에러/빈상태/로딩을 앱 전체에서 일관된 모양으로.
 * (alert() 대신 인라인 배너로 비차단 피드백을 준다.)
 */

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** 인라인 에러 배너. message 가 없으면 아무것도 렌더하지 않는다. */
export function ErrorBanner({
  message,
  className,
}: {
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className={cn(
        "rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive",
        className,
      )}
    >
      {message}
    </p>
  );
}

/** 데이터가 없을 때의 빈 상태 카드. */
export function EmptyState({
  icon = "🗒️",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-5xl">{icon}</p>
        <div>
          <p className="font-semibold">{title}</p>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

/** 로딩 스켈레톤(높이 지정 가능). */
export function Loading({ className }: { className?: string }) {
  return (
    <div
      aria-busy="true"
      aria-label="불러오는 중"
      className={cn("h-48 animate-pulse rounded-xl bg-secondary", className)}
    />
  );
}

/** 범용 스켈레톤 조각 — 목록/카드 자리표시용. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-lg bg-secondary", className)} />;
}
