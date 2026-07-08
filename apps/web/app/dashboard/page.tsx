import { redirect } from "next/navigation";
import type { Language } from "@nativo/core";
import { BookOpen, Clock, CreditCard, Flame, Quote, Mic, type LucideIcon } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { isChunkDue } from "@/lib/chunk-review";
import { getRoutineTasks } from "@/lib/routine";
import { StatCard } from "@/components/ui/stat-card";
import { HeroRecommendCard, SecondaryRecommendCard } from "./RecommendCard";
import { RoutineCard } from "./RoutineCard";

const LANGUAGE_LABEL: Record<Language, string> = {
  english: "영어 🇺🇸",
  spanish: "스페인어 🇪🇸",
  japanese: "일본어 🇯🇵",
};

type LoopKey = "flashcards" | "chunks" | "shadowing" | "reading";

interface LoopCard {
  icon: LucideIcon;
  title: string;
  href: string;
  remaining: string;
  reason: string;
  resume?: string;
  progress?: { value: number; max: number };
  urgent: boolean;
}

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
  const today = now.slice(0, 10);

  const [
    dueRes,
    totalRes,
    streakRes,
    shadowRes,
    todayLogRes,
    chunksRes,
    readingRes,
  ] = await Promise.all([
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
      .select("id, title, last_position_sec, completed")
      .eq("user_id", user.id)
      .eq("completed", false)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("daily_logs")
      .select("study_minutes")
      .eq("user_id", user.id)
      .eq("language", language)
      .eq("log_date", today)
      .maybeSingle(),
    supabase
      .from("chunks")
      .select("review_count, last_reviewed_at")
      .eq("user_id", user.id)
      .eq("language", language),
    supabase
      .from("content_history")
      .select("content_id, title, progress_pct")
      .eq("user_id", user.id)
      .eq("language", language)
      .eq("content_type", "book")
      .eq("completed", false)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const due = dueRes.count ?? 0;
  const total = totalRes.count ?? 0;
  const streak = streakRes.data?.streak_day ?? 0;
  const studyMinutes = todayLogRes.data?.study_minutes ?? 0;

  const chunkRows = chunksRes.data ?? [];
  const dueChunks = chunkRows.filter(isChunkDue).length;
  const totalChunks = chunkRows.length;

  const latestShadow = shadowRes.data;
  const shadowActive = !!latestShadow;
  const reading = readingRes.data;
  const readingActive = !!reading;

  const loops: Record<LoopKey, LoopCard> = {
    flashcards: {
      icon: CreditCard,
      title: "플래시카드 복습",
      href: "/learn/flashcards",
      remaining:
        due > 0 ? `${due}장 복습 대기` : total > 0 ? "오늘 복습 완료" : "카드가 아직 없어요",
      reason:
        due > 0
          ? "복습 예정일이 지난 카드가 있어요"
          : total > 0
            ? "새 단어를 추가해 어휘를 늘려보세요"
            : "학습을 시작해 첫 카드를 만들어보세요",
      progress: total > 0 ? { value: total - due, max: total } : undefined,
      urgent: due > 0,
    },
    chunks: {
      icon: Quote,
      title: "청크 복습",
      href: "/learn/chunks",
      remaining:
        dueChunks > 0
          ? `${dueChunks}개 복습 대기`
          : totalChunks > 0
            ? "오늘 복습 완료"
            : "청크가 아직 없어요",
      reason:
        dueChunks > 0
          ? "의미 덩어리 기억이 흐려지기 전에 복습해요"
          : totalChunks > 0
            ? "내 사전에서 새 표현을 담아보세요"
            : "마음에 드는 표현을 하트에 담아 시작해보세요",
      progress: totalChunks > 0 ? { value: totalChunks - dueChunks, max: totalChunks } : undefined,
      urgent: dueChunks > 0,
    },
    shadowing: {
      icon: Mic,
      title: shadowActive ? (latestShadow!.title ?? "쉐도잉 이어하기") : "쉐도잉",
      href: shadowActive ? `/learn/shadowing/${latestShadow!.id}` : "/learn/shadowing",
      remaining: shadowActive ? "이어서 연습하기" : "추가된 영상이 없어요",
      reason: shadowActive
        ? "꾸준함이 발음과 리듬을 바꿔요"
        : "좋아하는 YouTube 영상을 추가해 쉐도잉을 시작해보세요",
      resume:
        shadowActive && (latestShadow?.last_position_sec ?? 0) > 0
          ? `${Math.floor((latestShadow?.last_position_sec ?? 0) / 60)}분 지점부터`
          : undefined,
      urgent: shadowActive,
    },
    reading: {
      icon: BookOpen,
      title: readingActive ? (reading?.title ?? "읽기 이어하기") : "읽기",
      href: readingActive ? `/learn/reading/${reading?.content_id}` : "/learn/reading",
      remaining: readingActive ? "이어 읽기" : "읽고 있는 책이 없어요",
      reason: readingActive
        ? "문맥 속에서 단어를 익혀요"
        : "관심 있는 책을 검색해 읽기를 시작해보세요",
      resume: readingActive ? `${reading?.progress_pct ?? 0}% 읽음` : undefined,
      progress: readingActive ? { value: reading?.progress_pct ?? 0, max: 100 } : undefined,
      urgent: readingActive,
    },
  };

  const order: LoopKey[] = ["flashcards", "chunks", "shadowing", "reading"];
  const heroKey = order.find((k) => loops[k].urgent) ?? "flashcards";
  const secondaryKeys = order.filter((k) => k !== heroKey);

  const studyTimeLabel =
    studyMinutes >= 60
      ? `${Math.floor(studyMinutes / 60)}시간 ${studyMinutes % 60}분`
      : `${studyMinutes}분`;
  const dueTotal = due + dueChunks;

  return (
    <AppShell>
      <main className="container py-8 lg:py-10">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">
              안녕하세요, {name}님
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{LANGUAGE_LABEL[language]}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-highlight/10 px-3 py-1.5 text-sm font-medium text-highlight">
            <Flame className="h-4 w-4" aria-hidden />
            스트릭 {streak}일
          </span>
        </header>

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            지금 이어서 하면 좋아요
          </h2>
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="space-y-3 lg:col-span-2">
              <HeroRecommendCard {...loops[heroKey]} />
              {/* 히어로 아래 남는 공간 — 오늘의 루틴 요약으로 채운다 */}
              <RoutineCard language={language} tasks={getRoutineTasks(language)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {secondaryKeys.map((key) => (
                <SecondaryRecommendCard key={key} {...loops[key]} />
              ))}
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">오늘의 스냅샷</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="오늘 학습 시간"
              value={studyTimeLabel}
              icon={<Clock className="h-4 w-4" aria-hidden />}
            />
            <StatCard
              label="복습 예정"
              value={dueTotal > 0 ? `${dueTotal}개` : "없음"}
              sub={due > 0 || dueChunks > 0 ? `카드 ${due} · 청크 ${dueChunks}` : undefined}
              icon={<CreditCard className="h-4 w-4" aria-hidden />}
            />
            <StatCard
              label="스트릭"
              value={`${streak}일`}
              icon={<Flame className="h-4 w-4" aria-hidden />}
            />
            <StatCard
              label="청크 진행"
              value={totalChunks > 0 ? `${totalChunks - dueChunks}/${totalChunks}` : "없음"}
              icon={<Quote className="h-4 w-4" aria-hidden />}
            />
          </div>
        </section>
      </main>
    </AppShell>
  );
}
