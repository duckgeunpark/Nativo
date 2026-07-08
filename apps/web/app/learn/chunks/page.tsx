import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { BookHeart } from "lucide-react";
import type { CefrLevel, TablesInsert } from "@nativo/core";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { STUDY_CHUNK_COLUMNS, isChunkDue, type StudyChunk } from "@/lib/chunk-review";
import { nextNewChunks } from "@/lib/chunk-db";
import { SESSION_SIZE, parseSessionCookie } from "@/lib/session-size";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { ChunkReviewSession } from "./ChunkReviewSession";

export default async function ChunksPage() {
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
  const level = (profile?.current_level ?? "A2") as CefrLevel;

  // 회당 새로 소개할 청크 수(설정 — 쿠키, 기본 30)
  const sessionNew = parseSessionCookie(
    cookies().get(SESSION_SIZE.chunk.cookie)?.value,
    SESSION_SIZE.chunk.default,
  );

  const { data: allChunks } = await supabase
    .from("chunks")
    .select(STUDY_CHUNK_COLUMNS)
    .eq("user_id", user.id)
    .eq("language", language)
    .returns<StudyChunk[]>();

  // 복습 도래 청크(Leitner) — 오래된 것부터, 회당 학습량까지만(초과분은 다음 회차)
  let cards = (allChunks ?? [])
    .filter(isChunkDue)
    .sort((a, b) => ((a.last_reviewed_at ?? "") < (b.last_reviewed_at ?? "") ? -1 : 1))
    .slice(0, sessionNew);

  // 부족하면 chunk-db 에서 새 청크 자동 투입(레벨 ±1)
  if (cards.length < sessionNew) {
    const owned = new Set((allChunks ?? []).map((c) => c.expression.toLowerCase()));
    const fresh = nextNewChunks(language, level, owned, sessionNew - cards.length);
    if (fresh.length > 0) {
      const rows: TablesInsert<"chunks">[] = fresh.map((c) => ({
        user_id: user.id,
        language,
        expression: c.expression,
        translation_ko: c.translation_ko,
        situation: c.situation ?? null,
        nuance: c.nuance ?? null,
        example_1: c.example_1 ?? null,
        example_2: c.example_2 ?? null,
        category: c.category ?? null,
        level: c.level ?? null,
        source: "curated",
      }));
      const { data: inserted } = await supabase
        .from("chunks")
        .insert(rows)
        .select(STUDY_CHUNK_COLUMNS)
        .returns<StudyChunk[]>();
      cards = [...cards, ...(inserted ?? [])];
    }
  }

  return (
    <AppShell>
      <main className="container py-8 md:py-10">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">청크 복습</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              의미 덩어리를 카드로 복습하세요. 뜻을 떠올린 뒤 카드를 눌러 확인하고 다음으로.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href="/learn/chunks/dictionary">
              <BookHeart className="h-4 w-4" aria-hidden />
              내 청크 사전
            </Link>
          </Button>
        </div>

        {cards.length > 0 ? (
          <ChunkReviewSession chunks={cards} />
        ) : (
          <EmptyState
            icon="🎉"
            title="복습할 청크가 없어요!"
            description="전체 목록에서 새 표현을 하트로 담으면 복습에 들어옵니다."
            action={
              <Button asChild variant="outline">
                <Link href="/learn/chunks/dictionary?tab=all">전체 청크 둘러보기</Link>
              </Button>
            }
          />
        )}
      </main>
    </AppShell>
  );
}
