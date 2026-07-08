import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { BookHeart } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppShell } from "@/components/AppShell";
import type { TablesInsert } from "@nativo/core";
import { createClient } from "@/lib/supabase/server";
import { STUDY_CARD_COLUMNS, type StudyCard } from "@/lib/flashcards";
import { nextNewWords } from "@/lib/word-db";
import { SESSION_SIZE, parseSessionCookie } from "@/lib/session-size";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { StudySession } from "./StudySession";

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
    .select("selected_language, current_level")
    .eq("id", user.id)
    .single();
  const language = profile?.selected_language ?? "english";
  const level = profile?.current_level ?? "A2";

  // 회당 새로 소개할 단어 수(설정 — 쿠키, 기본 60)
  const newPerSession = parseSessionCookie(
    cookies().get(SESSION_SIZE.flashcard.cookie)?.value,
    SESSION_SIZE.flashcard.default,
  );

  // 1) 복습 도래 카드 — 회당 학습량까지만(초과분은 다음 회차), 오래된 순
  const { data: dueCards } = await supabase
    .from("flashcards")
    .select(STUDY_CARD_COLUMNS)
    .eq("user_id", user.id)
    .eq("language", language)
    .lte("next_review_at", new Date().toISOString())
    .order("next_review_at", { ascending: true })
    .limit(newPerSession)
    .returns<StudyCard[]>();

  let cards: StudyCard[] = dueCards ?? [];

  // 2) 복습 카드가 적으면 word-db 에서 새 단어를 자동 투입(레벨 ±1, 미학습 우선)
  if (cards.length < newPerSession) {
    const { data: ownedRows } = await supabase
      .from("flashcards")
      .select("word")
      .eq("user_id", user.id)
      .eq("language", language);
    const owned = new Set((ownedRows ?? []).map((r) => r.word.toLowerCase()));

    const fresh = nextNewWords(language, level, owned, newPerSession - cards.length);
    if (fresh.length > 0) {
      const rows: TablesInsert<"flashcards">[] = fresh.map((w) => ({
        user_id: user.id,
        language,
        word: w.word,
        meaning: w.meaning,
        meaning_en: w.meaning_en ?? null,
        pronunciation: w.pronunciation ?? null,
        example_1: w.example_1 ?? null,
        part_of_speech: w.part_of_speech ?? null,
        difficulty: w.difficulty ?? null,
        source: "curated",
      }));
      const { data: inserted } = await supabase
        .from("flashcards")
        .insert(rows)
        .select(STUDY_CARD_COLUMNS)
        .returns<StudyCard[]>();
      cards = [...cards, ...(inserted ?? [])];
    }
  }

  return (
    <AppShell>
      <main className="container py-8 md:py-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold text-foreground">플래시카드</h1>
          <Button asChild variant="outline" size="sm">
            <Link href="/learn/flashcards/dictionary">
              <BookHeart className="h-4 w-4" aria-hidden />
              내 단어 사전
            </Link>
          </Button>
        </div>
        {cards.length > 0 ? (
          <StudySession cards={cards} />
        ) : (
          <EmptyState
            icon="🎉"
            title="오늘 학습할 단어를 모두 끝냈어요!"
            description="복습할 카드가 생기면 다시 채워집니다. 내 단어 사전에서 완료한 단어를 볼 수 있어요."
            action={
              <Button asChild variant="outline">
                <Link href="/learn/flashcards/dictionary">내 단어 사전</Link>
              </Button>
            }
          />
        )}
      </main>
    </AppShell>
  );
}
