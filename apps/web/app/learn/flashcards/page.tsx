import { redirect } from "next/navigation";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { createClient } from "@/lib/supabase/server";
import { STUDY_CARD_COLUMNS, type StudyCard } from "@/lib/flashcards";
import { StudySession } from "./StudySession";

/** 한 세션에 가져올 최대 카드 수. */
const SESSION_LIMIT = 20;

export default async function FlashcardsPage() {
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

  // 복습 시점이 도래한(next_review_at <= now) 카드만, 가까운 순으로
  const { data: dueCards } = await supabase
    .from("flashcards")
    .select(STUDY_CARD_COLUMNS)
    .eq("user_id", user.id)
    .eq("language", language)
    .lte("next_review_at", new Date().toISOString())
    .order("next_review_at", { ascending: true })
    .limit(SESSION_LIMIT)
    .returns<StudyCard[]>();

  // 보유 카드 0개인지(빈 상태 안내 분기용)
  const { count: totalCount } = await supabase
    .from("flashcards")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("language", language);

  const cards = dueCards ?? [];

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← 대시보드
        </Link>
        <Link
          href="/learn/flashcards/new"
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm transition hover:bg-neutral-50"
        >
          + 카드 추가
        </Link>
      </header>

      {cards.length > 0 ? (
        <StudySession cards={cards} />
      ) : (
        <EmptyState hasNoCards={(totalCount ?? 0) === 0} />
      )}
    </main>
  );
}

function EmptyState({ hasNoCards }: { hasNoCards: boolean }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center">
      <p className="text-4xl">🎉</p>
      <p className="mt-3 font-semibold">
        {hasNoCards ? "아직 카드가 없어요" : "오늘 복습할 카드를 모두 끝냈어요!"}
      </p>
      <p className="mt-1 text-sm text-neutral-600">
        {hasNoCards
          ? "첫 단어 카드를 추가하고 학습을 시작해 보세요."
          : "내일 다시 복습 카드가 준비됩니다."}
      </p>
      <Link
        href="/learn/flashcards/new"
        className="mt-5 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition hover:opacity-90"
      >
        카드 추가하기
      </Link>
    </div>
  );
}
