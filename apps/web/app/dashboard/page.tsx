import { redirect } from "next/navigation";
import Link from "next/link";
import type { Language } from "@nativo/core";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import { getRoutineTasks } from "@/lib/routine";
import { Card, CardContent } from "@/components/ui/card";

const LANGUAGE_LABEL: Record<Language, string> = {
  english: "영어 🇺🇸",
  spanish: "스페인어 🇪🇸",
  japanese: "일본어 🇯🇵",
};

export default async function DashboardPage() {
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
    .select("display_name, selected_language")
    .eq("id", user.id)
    .single();

  const language = profile?.selected_language ?? "english";
  const name = profile?.display_name ?? user.email?.split("@")[0] ?? "학습자";

  const now = new Date().toISOString();
  const todayStart = `${now.slice(0, 10)}T00:00:00.000Z`;

  const [dueRes, totalRes, streakRes, shadowRes, routineRes] = await Promise.all([
    supabase
      .from("flashcards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("language", language)
      .lte("next_review_at", now),
    supabase
      .from("flashcards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("language", language),
    supabase
      .from("daily_logs")
      .select("streak_day")
      .eq("user_id", user.id)
      .eq("language", language)
      .order("streak_day", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("shadowing_videos")
      .select("id")
      .eq("user_id", user.id)
      .gte("updated_at", todayStart)
      .limit(1),
    supabase
      .from("daily_logs")
      .select("tasks_completed")
      .eq("user_id", user.id)
      .eq("language", language)
      .eq("log_date", now.slice(0, 10))
      .maybeSingle(),
  ]);

  const due = dueRes.count ?? 0;
  const total = totalRes.count ?? 0;
  const streak = streakRes.data?.streak_day ?? 0;

  // 오늘의 코스 단계별 완료 판정 (읽기 전용)
  const shadowingDone = (shadowRes.data?.length ?? 0) > 0;
  const reviewDone = total > 0 && due === 0;
  const routineTaskIds = getRoutineTasks(language).map((t) => t.id);
  const completedToday = routineRes.data?.tasks_completed ?? [];
  const routineDone =
    routineTaskIds.length > 0 && routineTaskIds.every((id) => completedToday.includes(id));

  const steps = [
    {
      icon: "🎧",
      label: "쉐도잉",
      sub: "영상을 따라 말하며 발음·리듬 훈련",
      href: "/learn/shadowing",
      done: shadowingDone,
    },
    {
      icon: "✏️",
      label: "플래시카드 복습",
      sub: reviewDone ? "오늘 복습 완료" : `복습할 카드 ${due}장`,
      href: "/learn/flashcards",
      done: reviewDone,
    },
    {
      icon: "✅",
      label: "오늘의 루틴",
      sub: routineDone ? "오늘 루틴 완료" : "학습 습관 체크",
      href: "/learn/routine",
      done: routineDone,
    },
  ];
  const nowIndex = steps.findIndex((s) => !s.done);

  return (
    <>
      <AppHeader />
      <main className="container max-w-2xl py-10">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">안녕하세요, {name}님</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {LANGUAGE_LABEL[language]} · 🔥 스트릭 {streak}일
          </p>
        </header>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">오늘의 코스</h2>
            <span className="text-xs text-muted-foreground">
              {steps.filter((s) => s.done).length}/{steps.length} 완료
            </span>
          </div>
          <Card>
            <CardContent className="divide-y p-0">
              {steps.map((s, i) => (
                <CourseStep
                  key={s.href}
                  n={i + 1}
                  icon={s.icon}
                  label={s.label}
                  sub={s.sub}
                  href={s.href}
                  done={s.done}
                  highlight={i === nowIndex}
                />
              ))}
            </CardContent>
          </Card>
        </section>
      </main>
    </>
  );
}

function CourseStep({
  n,
  icon,
  label,
  sub,
  href,
  done,
  highlight,
}: {
  n: number;
  icon: string;
  label: string;
  sub: string;
  href: string;
  done: boolean;
  highlight: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/50"
    >
      <span
        className={
          done
            ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success text-sm font-semibold text-success-foreground"
            : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-muted-foreground"
        }
      >
        {done ? "✓" : n}
      </span>
      <span className="text-xl">{icon}</span>
      <span className="flex-1">
        <span className={done ? "block font-medium text-muted-foreground" : "block font-medium"}>
          {label}
        </span>
        <span className="block text-sm text-muted-foreground">{sub}</span>
      </span>
      {highlight && (
        <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
          지금
        </span>
      )}
      <span className="text-muted-foreground">›</span>
    </Link>
  );
}
