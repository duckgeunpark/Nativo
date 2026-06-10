import { redirect } from "next/navigation";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import { STUDY_CARD_COLUMNS, type StudyCard } from "@/lib/flashcards";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  const { data: dueCards } = await supabase
    .from("flashcards")
    .select(STUDY_CARD_COLUMNS)
    .eq("user_id", user.id)
    .eq("language", language)
    .lte("next_review_at", new Date().toISOString())
    .order("next_review_at", { ascending: true })
    .limit(SESSION_LIMIT)
    .returns<StudyCard[]>();

  const { count: totalCount } = await supabase
    .from("flashcards")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("language", language);

  const cards = dueCards ?? [];

  return (
    <>
      <AppHeader />
      <main className="container max-w-xl py-10">
        {cards.length > 0 ? (
          <StudySession cards={cards} />
        ) : (
          <EmptyState hasNoCards={(totalCount ?? 0) === 0} />
        )}
      </main>
    </>
  );
}

function EmptyState({ hasNoCards }: { hasNoCards: boolean }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="text-5xl">{hasNoCards ? "📚" : "🎉"}</p>
        <div>
          <p className="font-semibold">
            {hasNoCards ? "아직 카드가 없어요" : "오늘 복습할 카드를 모두 끝냈어요!"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasNoCards
              ? "단어 은행에서 단어를 추가하면 뜻·발음이 자동으로 채워집니다."
              : "내일 다시 복습 카드가 준비됩니다."}
          </p>
        </div>
        <Button asChild>
          <Link href="/learn/wordbank">단어 은행에서 단어 담기</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
