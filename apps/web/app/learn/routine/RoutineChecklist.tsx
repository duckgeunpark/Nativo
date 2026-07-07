"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  Quote,
  Mic,
  BookOpen,
  Flame,
  ChevronRight,
  ShieldCheck,
  Lock,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import type { DailyTaskId, Language, Phase } from "@nativo/core";
import { getRoutineState, saveDailyRoutine } from "./actions";
import { STREAK_GOAL_DAYS, type RoutineTask } from "@/lib/routine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorBanner, Skeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils";

/** 태스크 표시용 아이콘 매핑 — 스키마 확장 없이 화면 전용으로만 사용. */
const TASK_ICON: Record<DailyTaskId, LucideIcon> = {
  flashcard_review: CreditCard,
  verb_conjugation: Quote,
  youtube_listening: Mic,
  reading_aloud: BookOpen,
  hiragana_review: CreditCard,
  katakana_review: CreditCard,
};

/** Phase 라벨 — users.current_phase(1~5) 표시용. 화면 전용 매핑. */
const PHASE_LABEL: Record<Phase, string> = {
  1: "시작하기",
  2: "기초 다지기",
  3: "유창성 확장",
  4: "표현 다듬기",
  5: "고급 숙달",
};
const PHASES: Phase[] = [1, 2, 3, 4, 5];

const WEEKDAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

/** 로컬 타임존 기준 YYYY-MM-DD (offsetDays 만큼 가감). */
function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface Props {
  language: Language;
  tasks: RoutineTask[];
  currentPhase: Phase;
}

export function RoutineChecklist({ language, tasks, currentPhase }: Props) {
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState<Set<DailyTaskId>>(new Set());
  const [yesterdayStreak, setYesterdayStreak] = useState(0);
  const [week, setWeek] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => localDate(i - 6)),
    [],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      const {
        completed: done,
        yesterdayStreak: streak,
        week: weekData,
      } = await getRoutineState(language, localDate(0), localDate(-1), weekDates);
      if (!active) return;
      setCompleted(new Set(done));
      setYesterdayStreak(streak);
      setWeek(weekData);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [language, weekDates]);

  const isComplete = tasks.length > 0 && tasks.every((t) => completed.has(t.id));
  const remaining = tasks.length - tasks.filter((t) => completed.has(t.id)).length;
  const currentStreak = isComplete ? yesterdayStreak + 1 : yesterdayStreak;

  async function toggle(id: DailyTaskId) {
    if (saving) return;
    const next = new Set(completed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCompleted(next);
    await save(next);
  }

  async function save(set: Set<DailyTaskId>) {
    setSaving(true);
    setError(null);

    const completedIds = tasks.map((t) => t.id).filter((id) => set.has(id));
    const complete = completedIds.length === tasks.length && tasks.length > 0;
    const minutes = tasks
      .filter((t) => set.has(t.id))
      .reduce((sum, t) => sum + t.minutes, 0);
    const streakDay = complete ? yesterdayStreak + 1 : 0;

    const res = await saveDailyRoutine({
      language,
      logDate: localDate(0),
      tasksCompleted: completedIds,
      studyMinutes: minutes,
      streakDay,
    });

    setSaving(false);
    if (!res.ok) {
      setError(`저장 실패: ${res.error ?? "알 수 없는 오류"}`);
      return;
    }
    // 오늘 항목이 바뀐 만큼 주간 달력도 함께 갱신
    setWeek((prev) => ({ ...prev, [localDate(0)]: completedIds.length }));
  }

  if (loading) {
    return (
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <div className="space-y-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* 메인 체크리스트 */}
      <div className="space-y-4 lg:col-span-2">
        <div className="flex items-start gap-3 rounded-xl bg-success/10 p-4 text-sm text-success">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p>모든 항목을 완료하면 스트릭이 유지되고 학습 흐름이 이어져요.</p>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{tasks.length}개 항목</span>
        </div>

        <Card>
          <ul className="divide-y" role="list">
            {tasks.map((task) => {
              const checked = completed.has(task.id);
              const Icon = TASK_ICON[task.id];
              return (
                <li key={task.id} className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
                  {/* 체크 토글 — 클릭 영역이 바로가기와 분리되어 있다 */}
                  <button
                    type="button"
                    onClick={() => toggle(task.id)}
                    disabled={saving}
                    aria-pressed={checked}
                    aria-label={checked ? `${task.label} 완료 취소` : `${task.label} 완료 표시`}
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors disabled:opacity-60",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:border-primary/50",
                    )}
                  >
                    {checked && <CheckCircle2 className="h-4 w-4" aria-hidden />}
                  </button>

                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground"
                    aria-hidden
                  >
                    <Icon className="h-5 w-5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate font-medium", checked && "text-muted-foreground line-through")}>
                      {task.label}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      권장 시간 {task.minutes}분
                    </p>
                  </div>

                  {task.href ? (
                    <Button asChild size="sm" variant={checked ? "outline" : "default"}>
                      <Link href={task.href}>
                        시작
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </Link>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">진행 중</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        {isComplete ? (
          <div className="flex items-center gap-3 rounded-xl bg-success/10 p-4 text-sm font-medium text-success">
            <Flame className="h-5 w-5 shrink-0" aria-hidden />
            오늘의 루틴 완료! 스트릭 {currentStreak}일째
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl bg-highlight/10 p-4 text-sm font-medium text-highlight">
            <Flame className="h-5 w-5 shrink-0" aria-hidden />
            {remaining}개 항목을 마치면 스트릭이 유지돼요
          </div>
        )}
        <ErrorBanner message={error} />
      </div>

      {/* 사이드바 — 스트릭 + Phase 태스크 */}
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">스트릭</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-highlight/10 text-highlight">
                <Flame className="h-7 w-7" aria-hidden />
              </span>
              <p>
                <span className="text-3xl font-bold tabular-nums">{currentStreak}</span>
                <span className="ml-1 text-sm text-muted-foreground">일</span>
              </p>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {weekDates.map((d) => {
                const count = week[d] ?? 0;
                const isToday = d === localDate(0);
                const done = tasks.length > 0 && count >= tasks.length;
                const partial = count > 0 && !done;
                const weekday = WEEKDAY_LABEL[new Date(`${d}T00:00:00`).getDay()];
                return (
                  <div key={d} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">{weekday}</span>
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-[10px]",
                        done && "bg-highlight text-highlight-foreground",
                        partial && "bg-highlight/20 text-highlight",
                        !done && !partial && "bg-secondary text-muted-foreground",
                        isToday && "ring-2 ring-ring ring-offset-1 ring-offset-card",
                      )}
                    >
                      {done ? "✓" : ""}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground">
              {isComplete ? "잘하고 있어요! 계속 이어가요." : "전체 완료로 스트릭을 지켜보세요."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Phase 태스크</CardTitle>
            <p className="text-xs text-muted-foreground">
              단계를 진행할수록 새로운 태스크가 열려요.
            </p>
          </CardHeader>
          <CardContent className="space-y-1">
            {PHASES.map((phase) => {
              const state =
                phase < currentPhase ? "done" : phase === currentPhase ? "current" : "locked";
              return (
                <div
                  key={phase}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2 py-2",
                    state === "current" && "bg-secondary",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                      state === "done" && "bg-success text-success-foreground",
                      state === "current" && "bg-primary text-primary-foreground",
                      state === "locked" && "bg-secondary text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    {state === "locked" ? <Lock className="h-3 w-3" /> : phase}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      Phase {phase} · {PHASE_LABEL[phase]}
                    </p>
                  </div>
                  {state === "current" && tasks.length > 0 && (
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {completed.size}/{tasks.length}
                    </span>
                  )}
                  {state === "locked" && (
                    <span className="shrink-0 text-xs text-muted-foreground">잠김</span>
                  )}
                </div>
              );
            })}
            <p className="pt-2 text-xs text-muted-foreground">
              스트릭 {STREAK_GOAL_DAYS}일 달성이 Phase 1 졸업 조건 중 하나예요.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
