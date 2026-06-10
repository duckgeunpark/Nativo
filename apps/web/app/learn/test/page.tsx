import { redirect } from "next/navigation";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { createClient } from "@/lib/supabase/server";
import { PHASE1 } from "@/lib/phase";
import { VocabTest, type QuizCard } from "./VocabTest";

export default async function VocabTestPage() {
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

  const { data: cards } = await supabase
    .from("flashcards")
    .select("word, meaning")
    .eq("user_id", user.id)
    .eq("language", language)
    .returns<QuizCard[]>();

  const pool = cards ?? [];

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <header className="mb-8">
        <Link href="/dashboard" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← 대시보드
        </Link>
        <h1 className="mt-2 text-2xl font-bold">단어 테스트</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {PHASE1.REQUIRED_TEST_SCORE}점 이상이면 Phase 1 졸업 조건 하나를 충족합니다.
        </p>
      </header>

      {pool.length >= PHASE1.TEST_CHOICES ? (
        <VocabTest pool={pool} language={language} />
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center">
          <p className="font-semibold">테스트를 보려면 카드가 더 필요해요</p>
          <p className="mt-1 text-sm text-neutral-600">
            보기 4개를 만들려면 최소 {PHASE1.TEST_CHOICES}개의 카드가 필요합니다.
          </p>
          <Link
            href="/learn/flashcards/new"
            className="mt-5 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition hover:opacity-90"
          >
            카드 추가하기
          </Link>
        </div>
      )}
    </main>
  );
}
