import { redirect } from "next/navigation";
import type { Language, Phase } from "@nativo/core";
import {
  Flame,
  Award,
  Clock,
  CalendarDays,
  BookOpen,
  GraduationCap,
  Lock,
  TrendingUp,
} from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { aggregateStats, type DailyLogRow } from "@/lib/stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { cn } from "@/lib/utils";

const LANGUAGE_LABEL: Record<Language, string> = {
  english: "영어 🇺🇸",
  spanish: "스페인어 🇪🇸",
  japanese: "일본어 🇯🇵",
};

const PHASE_LABEL: Record<Phase, string> = {
  1: "시작하기",
  2: "기초 다지기",
  3: "유창성 확장",
  4: "표현 다듬기",
  5: "고급 숙달",
};
const PHASES: Phase[] = [1, 2, 3, 4, 5];

/** YYYY-MM-DD, UTC 기준(daily_logs.log_date 와 동일 기준으로 비교). */
function shiftDate(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
}

export default async function StatsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <SupabaseNotice />
      </main>
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("selected_language, current_phase")
    .eq("id", user.id)
    .single();
  const language = profile?.selected_language ?? "english";
  const currentPhase = (profile?.current_phase ?? 1) as Phase;

  const [fcRes, chunkRes, logRes] = await Promise.all([
    supabase
      .from("flashcards")
      .select("repetitions")
      .eq("user_id", user.id)
      .eq("language", language),
    supabase
      .from("chunks")
      .select("review_count")
      .eq("user_id", user.id)
      .eq("language", language),
    supabase
      .from("daily_logs")
      .select("log_date, study_minutes, streak_day")
      .eq("user_id", user.id)
      .eq("language", language),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const dailyLogs = (logRes.data ?? []) as DailyLogRow[];
  const stats = aggregateStats({
    flashcards: fcRes.data ?? [],
    chunks: chunkRes.data ?? [],
    dailyLogs,
    today,
  });

  const byDate = new Map(dailyLogs.map((l) => [l.log_date, l]));
  const hasHistory = dailyLogs.length > 0;

  // 최근 30일 루틴 달성 도트 (실데이터: study_minutes>0 이거나 streak_day>0 인 날)
  const last30 = Array.from({ length: 30 }, (_, i) => shiftDate(today, i - 29));
  const activeDays30 = last30.filter((d) => {
    const row = byDate.get(d);
    return (row?.study_minutes ?? 0) > 0 || (row?.streak_day ?? 0) > 0;
  });
  const routine30Rate = Math.round((activeDays30.length / 30) * 100);

  // 최근 14일 학습 추이
  const last14 = Array.from({ length: 14 }, (_, i) => shiftDate(today, i - 13));
  const trend = last14.map((d) => ({ date: d, minutes: byDate.get(d)?.study_minutes ?? 0 }));
  const maxTrendMinutes = Math.max(1, ...trend.map((t) => t.minutes));

  const wordRate = stats.totalWords > 0 ? (stats.completedWords / stats.totalWords) * 100 : 0;
  const chunkRate = stats.totalChunks > 0 ? (stats.completedChunks / stats.totalChunks) * 100 : 0;
  const currentPhaseProgress =
    stats.totalWords + stats.totalChunks > 0 ? Math.round((wordRate + chunkRate) / 2) : 0;

  const monthPrefix = today.slice(0, 7);
  const monthMinutes = dailyLogs
    .filter((l) => l.log_date.startsWith(monthPrefix))
    .reduce((sum, l) => sum + (l.study_minutes || 0), 0);
  const avgDailyMinutes = stats.studyDays > 0 ? Math.round(stats.totalStudyMinutes / stats.studyDays) : 0;
  const mostActive = dailyLogs.slice().sort((a, b) => b.study_minutes - a.study_minutes)[0];
  const mostActiveLabel = mostActive
    ? `${Number(mostActive.log_date.slice(5, 7))}월 ${Number(mostActive.log_date.slice(8, 10))}일`
    : "기록 없음";

  const achievements = [
    { id: "streak7", label: "7일 스트릭", sub: "꾸준함을 지켰어요", achieved: stats.longestStreak >= 7 },
    { id: "streak30", label: "30일 스트릭", sub: "한 달을 완주했어요", achieved: stats.longestStreak >= 30 },
    { id: "words100", label: "단어 100개 완료", sub: "탄탄한 어휘력", achieved: stats.completedWords >= 100 },
    { id: "chunks100", label: "청크 100개 복습", sub: "자연스러운 표현", achieved: stats.completedChunks >= 100 },
    { id: "days30", label: "학습 30일 달성", sub: "누적 학습일 30일", achieved: stats.studyDays >= 30 },
  ].filter((a) => a.achieved);

  return (
    <AppShell>
      <main className="container max-w-5xl py-8 lg:py-10">
        <header className="mb-6">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">통계</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {LANGUAGE_LABEL[language]} · 진행 상황을 추적하고 꾸준함을 확인해요.
          </p>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="현재 스트릭"
            value={`${stats.currentStreak}일`}
            sub={stats.currentStreak > 0 ? "계속 이어가요!" : undefined}
            icon={<Flame className="h-4 w-4" aria-hidden />}
          />
          <StatCard
            label="최장 스트릭"
            value={`${stats.longestStreak}일`}
            icon={<Award className="h-4 w-4" aria-hidden />}
          />
          <StatCard
            label="누적 학습 시간"
            value={formatMinutes(stats.totalStudyMinutes)}
            sub={`이번 달 ${formatMinutes(monthMinutes)}`}
            icon={<Clock className="h-4 w-4" aria-hidden />}
          />
          <StatCard
            label="학습한 날"
            value={`${stats.studyDays}일`}
            icon={<CalendarDays className="h-4 w-4" aria-hidden />}
          />
          <StatCard
            label="단어 · 청크"
            value={`${stats.completedWords + stats.completedChunks} / ${stats.totalWords + stats.totalChunks}`}
            sub="완료 / 전체"
            icon={<BookOpen className="h-4 w-4" aria-hidden />}
          />
        </section>

        <section className="mb-6 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Phase 진행도</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-2">
                {PHASES.map((phase) => {
                  const state =
                    phase < currentPhase ? "done" : phase === currentPhase ? "current" : "locked";
                  const pct = state === "done" ? 100 : state === "current" ? currentPhaseProgress : 0;
                  return (
                    <div key={phase} className="flex flex-col items-center gap-2 text-center">
                      <span
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                          state === "done" && "bg-success text-success-foreground",
                          state === "current" && "bg-primary text-primary-foreground",
                          state === "locked" && "bg-secondary text-muted-foreground",
                        )}
                      >
                        {state === "locked" ? <Lock className="h-3.5 w-3.5" /> : phase}
                      </span>
                      <p className="truncate text-xs font-medium">Phase {phase}</p>
                      <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
                        {PHASE_LABEL[phase]}
                      </p>
                      <p className="w-full text-[11px] tabular-nums text-muted-foreground">{pct}%</p>
                      <ProgressBar
                        value={pct}
                        tone={state === "done" ? "success" : "primary"}
                        aria-label={`Phase ${phase} 진행도`}
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
                30일 루틴 달성
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-3xl font-bold tabular-nums">{routine30Rate}%</p>
              <div className="grid grid-cols-10 gap-1">
                {last30.map((d) => {
                  const row = byDate.get(d);
                  const active = (row?.study_minutes ?? 0) > 0 || (row?.streak_day ?? 0) > 0;
                  return (
                    <span
                      key={d}
                      aria-hidden
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        active ? "bg-success" : "bg-secondary",
                      )}
                    />
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {routine30Rate >= 100
                  ? "완벽해요! 30일을 모두 채웠어요."
                  : hasHistory
                    ? "꾸준히 쌓아가는 중이에요."
                    : "학습을 시작하면 여기에 기록이 쌓여요."}
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="mb-6 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden />
                학습 추이 (최근 14일)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasHistory ? (
                <div className="flex h-32 items-end gap-1.5 sm:gap-2">
                  {trend.map((t) => (
                    <div key={t.date} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className={cn(
                          "w-full rounded-t-sm transition-[height]",
                          t.minutes > 0 ? "bg-primary" : "bg-secondary",
                        )}
                        style={{ height: `${Math.max(4, (t.minutes / maxTrendMinutes) * 100)}%` }}
                        aria-hidden
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {Number(t.date.slice(8, 10))}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon="📈"
                  title="아직 학습 기록이 없어요"
                  description="루틴을 완료하면 추이가 여기에 나타나요."
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <GraduationCap className="h-4 w-4 text-muted-foreground" aria-hidden />
                졸업까지
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-3xl font-bold tabular-nums">{currentPhase - 1} / 5</p>
              <ProgressBar
                value={currentPhase - 1}
                max={5}
                tone="highlight"
                aria-label="Phase 졸업 진행도"
              />
              <p className="text-xs text-muted-foreground">
                {currentPhase >= 5
                  ? "모든 단계를 완료했어요. 축하해요!"
                  : "5단계를 모두 마치면 졸업 배지를 받아요."}
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">요약</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="평균 일일 학습 시간" value={hasHistory ? formatMinutes(avgDailyMinutes) : "기록 없음"} />
              <Row label="가장 활발했던 날" value={mostActiveLabel} />
              <Row label="단어 숙지율" value={`${Math.round(wordRate)}%`} />
              <Row label="청크 숙지율" value={`${Math.round(chunkRate)}%`} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">최근 달성</CardTitle>
            </CardHeader>
            <CardContent>
              {achievements.length > 0 ? (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {achievements.slice(0, 4).map((a) => (
                    <li key={a.id} className="flex items-center gap-3 rounded-lg bg-secondary/60 p-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-highlight/10 text-highlight">
                        <Award className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{a.label}</p>
                        <p className="truncate text-xs text-muted-foreground">{a.sub}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon="🏅"
                  title="아직 달성한 배지가 없어요"
                  description="학습을 이어가면 배지가 하나씩 열려요."
                />
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium tabular-nums">{value}</span>
    </div>
  );
}
