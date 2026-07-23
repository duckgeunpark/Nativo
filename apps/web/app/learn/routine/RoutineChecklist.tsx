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
  Sparkles,
  Target,
  PartyPopper,
  X,
  type LucideIcon,
} from "lucide-react";
import type { DailyTaskId, Language, Phase } from "@nativo/core";
import { getRoutineState, saveDailyRoutine, checkAndAdvancePhase } from "./actions";
import type { RoutineTask } from "@/lib/routine";
import { PHASE_LABEL, PHASES, type PhaseEvaluation } from "@/lib/phases";
import type { SkillProfile } from "@/lib/skills";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
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
  evaluation: PhaseEvaluation;
  skillProfile: SkillProfile;
  justAdvancedTo: Phase | null;
}

export function RoutineChecklist({
  language,
  tasks,
  currentPhase,
  evaluation: evaluationProp,
  skillProfile: skillProfileProp,
  justAdvancedTo,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState<Set<DailyTaskId>>(new Set());
  const [yesterdayStreak, setYesterdayStreak] = useState(0);
  const [week, setWeek] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 페이즈 진행 상태(루틴 완료 후 서버 재평가로 갱신).
  const [phase, setPhase] = useState<Phase>(currentPhase);
  const [evaluation, setEvaluation] = useState<PhaseEvaluation>(evaluationProp);
  const [skillProfile, setSkillProfile] = useState<SkillProfile>(skillProfileProp);
  const [celebrateTo, setCelebrateTo] = useState<Phase | null>(justAdvancedTo);

  const weakTaskId = skillProfile.recommendation.taskId;

  // 이번 주 일요일~토요일 (달력 순서 고정: 일 월 화 수 목 금 토)
  const weekDates = useMemo(() => {
    const todayDow = new Date().getDay();
    return Array.from({ length: 7 }, (_, i) => localDate(i - todayDow));
  }, []);

  // 최약 스킬에 해당하는 핵심 태스크를 상단으로.
  const orderedTasks = useMemo(() => {
    if (!weakTaskId) return tasks;
    return [...tasks].sort((a, b) => Number(b.id === weakTaskId) - Number(a.id === weakTaskId));
  }, [tasks, weakTaskId]);

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

    if (!res.ok) {
      setSaving(false);
      setError(`저장 실패: ${res.error ?? "알 수 없는 오류"}`);
      return;
    }
    // 오늘 항목이 바뀐 만큼 주간 달력도 함께 갱신
    setWeek((prev) => ({ ...prev, [localDate(0)]: completedIds.length }));

    // 저장 후 페이즈 조건 재평가 → 충족 시 자동 진급 + 축하.
    try {
      const prog = await checkAndAdvancePhase(language, localDate(0));
      setPhase(prog.currentPhase);
      setEvaluation(prog.evaluation);
      setSkillProfile(prog.skillProfile);
      if (prog.advancedTo) setCelebrateTo(prog.advancedTo);
    } catch {
      // 진급 평가 실패는 루틴 저장 자체를 막지 않는다.
    }
    setSaving(false);
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

  const rec = skillProfile.recommendation;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* 진급 축하 배너 */}
      {celebrateTo && (
        <div className="lg:col-span-3">
          <div className="flex items-center gap-3 rounded-xl border border-highlight/30 bg-highlight/10 p-4 text-sm text-highlight">
            <PartyPopper className="h-5 w-5 shrink-0" aria-hidden />
            <p className="flex-1 font-medium">
              🎉 Phase {celebrateTo} · {PHASE_LABEL[celebrateTo as Phase]} 달성! 다음 단계가 열렸어요.
            </p>
            <button
              type="button"
              onClick={() => setCelebrateTo(null)}
              className="shrink-0 rounded-md p-1 hover:bg-highlight/20"
              aria-label="닫기"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}

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
            {orderedTasks.map((task) => {
              const checked = completed.has(task.id);
              const Icon = TASK_ICON[task.id];
              const isWeak = task.id === weakTaskId;
              return (
                <li
                  key={task.id}
                  className={cn(
                    "flex items-center gap-3 p-3 sm:gap-4 sm:p-4",
                    isWeak && "bg-highlight/5",
                  )}
                >
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
                    <p className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "truncate font-medium",
                          checked && "text-muted-foreground line-through",
                        )}
                      >
                        {task.label}
                      </span>
                      {isWeak && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-highlight/15 px-1.5 py-0.5 text-[10px] font-medium text-highlight">
                          <Sparkles className="h-2.5 w-2.5" aria-hidden /> 추천 보강
                        </span>
                      )}
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

      {/* 사이드바 — 오늘의 보강 + 스트릭 + 졸업 조건 + Phase 여정 */}
      <div className="space-y-6">
        {/* 오늘의 보강 (최약 스킬) */}
        <Card className="border-highlight/30 bg-highlight/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-highlight" aria-hidden />
              오늘의 보강
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-semibold">{rec.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{rec.reason}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{skillProfile.weakest.label}</span>
              <ProgressBar value={skillProfile.weakest.score} tone="highlight" aria-label="최약 스킬 점수" />
              <span className="text-xs tabular-nums text-muted-foreground">
                {skillProfile.weakest.score}
              </span>
            </div>
            <Button asChild size="sm" className="w-full bg-highlight text-highlight-foreground hover:bg-highlight/90">
              <Link href={rec.href}>
                {rec.ctaLabel} 바로가기
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </CardContent>
        </Card>

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
                const isFuture = d > localDate(0);
                const done = tasks.length > 0 && count >= tasks.length;
                const partial = count > 0 && !done;
                const weekday = WEEKDAY_LABEL[new Date(`${d}T00:00:00`).getDay()];
                return (
                  <div
                    key={d}
                    className={cn("flex flex-col items-center gap-1", isFuture && "opacity-40")}
                  >
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

        {/* 졸업 조건 (현재 페이즈) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-muted-foreground" aria-hidden />
              Phase {phase} 졸업 조건
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {phase >= 5
                ? `${evaluation.metCount}/${evaluation.total} 달성 · 최종 단계`
                : `${evaluation.metCount}/${evaluation.total} 달성 · 모두 채우면 자동 진급해요`}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {evaluation.conditions.map((c) => (
              <div key={c.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className={cn("flex items-center gap-1", c.met && "text-success")}>
                    {c.met && <CheckCircle2 className="h-3 w-3" aria-hidden />}
                    {c.label}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {c.current}/{c.target}
                    {c.unit}
                  </span>
                </div>
                <ProgressBar
                  value={c.pct}
                  tone={c.met ? "success" : "primary"}
                  aria-label={`${c.label} 진행도`}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Phase 여정 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Phase 여정</CardTitle>
            <p className="text-xs text-muted-foreground">단계를 졸업하면 다음 단계가 열려요.</p>
          </CardHeader>
          <CardContent className="space-y-1">
            {PHASES.map((p) => {
              const state = p < phase ? "done" : p === phase ? "current" : "locked";
              return (
                <div
                  key={p}
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
                    {state === "locked" ? <Lock className="h-3 w-3" /> : p}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      Phase {p} · {PHASE_LABEL[p]}
                    </p>
                  </div>
                  {state === "current" && (
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {evaluation.progressPct}%
                    </span>
                  )}
                  {state === "locked" && (
                    <span className="shrink-0 text-xs text-muted-foreground">잠김</span>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
