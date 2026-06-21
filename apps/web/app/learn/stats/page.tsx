import { redirect } from "next/navigation";
import type { Language } from "@nativo/core";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import { aggregateStats, type DailyLogRow } from "@/lib/stats";
import { Card, CardContent } from "@/components/ui/card";

const LANGUAGE_LABEL: Record<Language, string> = {
  english: "영어 🇺🇸",
  spanish: "스페인어 🇪🇸",
  japanese: "일본어 🇯🇵",
};

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
    .select("selected_language")
    .eq("id", user.id)
    .single();
  const language = profile?.selected_language ?? "english";

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

  const stats = aggregateStats({
    flashcards: fcRes.data ?? [],
    chunks: chunkRes.data ?? [],
    dailyLogs: (logRes.data ?? []) as DailyLogRow[],
    today: new Date().toISOString().slice(0, 10),
  });

  const hours = Math.floor(stats.totalStudyMinutes / 60);
  const minutes = stats.totalStudyMinutes % 60;
  const studyTimeLabel = hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;

  return (
    <>
      <AppHeader />
      <main className="container max-w-2xl py-10">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">학습 통계</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {LANGUAGE_LABEL[language]} 학습 누적 기록
          </p>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="현재 스트릭" value={`${stats.currentStreak}일`} accent />
          <StatCard label="최장 스트릭" value={`${stats.longestStreak}일`} />
          <StatCard label="누적 학습" value={studyTimeLabel} />
          <StatCard label="학습한 날" value={`${stats.studyDays}일`} />
          <StatCard
            label="단어"
            value={`${stats.completedWords} / ${stats.totalWords}`}
            sub="완료 / 전체"
          />
          <StatCard
            label="청크"
            value={`${stats.completedChunks} / ${stats.totalChunks}`}
            sub="완료 / 전체"
          />
        </section>

        <Card>
          <CardContent className="space-y-4 py-6">
            <ProgressRow
              label="단어 숙지율"
              done={stats.completedWords}
              total={stats.totalWords}
            />
            <ProgressRow
              label="청크 숙지율"
              done={stats.completedChunks}
              total={stats.totalChunks}
            />
          </CardContent>
        </Card>
      </main>
    </>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-4 text-center">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={accent ? "mt-1 text-2xl font-bold text-primary" : "mt-1 text-2xl font-bold"}>
          {value}
        </p>
        {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function ProgressRow({
  label,
  done,
  total,
}: {
  label: string;
  done: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
