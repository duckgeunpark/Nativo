"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Flame } from "lucide-react";
import type { DailyTaskId, Language } from "@nativo/core";
import { getRoutineState, saveDailyRoutine } from "@/app/learn/routine/actions";
import type { RoutineTask } from "@/lib/routine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBanner, Skeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils";

/** 로컬 타임존 기준 YYYY-MM-DD (offsetDays 만큼 가감). */
function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 대시보드용 오늘의 루틴 요약 카드.
 * 루틴 페이지(RoutineChecklist)와 같은 daily_logs 를 읽고 쓰므로 양쪽 체크가 서로 반영된다.
 */
export function RoutineCard({
  language,
  tasks,
}: {
  language: Language;
  tasks: RoutineTask[];
}) {
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState<Set<DailyTaskId>>(new Set());
  const [yesterdayStreak, setYesterdayStreak] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { completed: done, yesterdayStreak: streak } = await getRoutineState(
        language,
        localDate(0),
        localDate(-1),
        [],
      );
      if (!active) return;
      setCompleted(new Set(done));
      setYesterdayStreak(streak);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [language]);

  const doneCount = tasks.filter((t) => completed.has(t.id)).length;
  const isComplete = tasks.length > 0 && doneCount === tasks.length;
  const remaining = tasks.length - doneCount;

  async function toggle(id: DailyTaskId) {
    if (saving) return;
    const next = new Set(completed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCompleted(next);

    setSaving(true);
    setError(null);
    const completedIds = tasks.map((t) => t.id).filter((tid) => next.has(tid));
    const complete = completedIds.length === tasks.length && tasks.length > 0;
    const minutes = tasks
      .filter((t) => next.has(t.id))
      .reduce((sum, t) => sum + t.minutes, 0);
    const res = await saveDailyRoutine({
      language,
      logDate: localDate(0),
      tasksCompleted: completedIds,
      studyMinutes: minutes,
      streakDay: complete ? yesterdayStreak + 1 : 0,
    });
    setSaving(false);
    if (!res.ok) setError(`저장 실패: ${res.error ?? "알 수 없는 오류"}`);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">오늘의 루틴</CardTitle>
        <Link
          href="/learn/routine"
          className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
        >
          전체 보기 <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-32" />
        ) : (
          <>
            <ul className="divide-y" role="list">
              {tasks.map((task) => {
                const checked = completed.has(task.id);
                return (
                  <li key={task.id} className="flex items-center gap-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggle(task.id)}
                      disabled={saving}
                      aria-pressed={checked}
                      aria-label={
                        checked ? `${task.label} 완료 취소` : `${task.label} 완료 표시`
                      }
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors disabled:opacity-60",
                        checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background hover:border-primary/50",
                      )}
                    >
                      {checked && <CheckCircle2 className="h-4 w-4" aria-hidden />}
                    </button>
                    <p
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm font-medium",
                        checked && "text-muted-foreground line-through",
                      )}
                    >
                      {task.label}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {task.minutes}분
                    </span>
                    {task.href && (
                      <Link
                        href={task.href}
                        aria-label={`${task.label} 시작`}
                        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
            <p
              className={cn(
                "mt-3 flex items-center gap-1.5 text-xs font-medium",
                isComplete ? "text-success" : "text-highlight",
              )}
            >
              <Flame className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {isComplete
                ? "오늘의 루틴 완료! 스트릭이 유지돼요"
                : `${remaining}개 항목을 마치면 스트릭이 유지돼요`}
            </p>
            <ErrorBanner message={error} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
