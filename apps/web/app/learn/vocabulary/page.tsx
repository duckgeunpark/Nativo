import { redirect } from "next/navigation";
import Link from "next/link";
import { CreditCard, Quote, Library, ChevronRight } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { isChunkDue } from "@/lib/chunk-review";
import { Card, CardContent } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";

export default async function VocabularyHubPage() {
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
  const now = new Date().toISOString();

  const [dueRes, totalRes, chunksRes, recentRes] = await Promise.all([
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
      .from("chunks")
      .select("review_count, last_reviewed_at")
      .eq("user_id", user.id)
      .eq("language", language),
    supabase
      .from("flashcards")
      .select("id, word, meaning")
      .eq("user_id", user.id)
      .eq("language", language)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const dueFlashcards = dueRes.count ?? 0;
  const totalFlashcards = totalRes.count ?? 0;
  const chunkRows = chunksRes.data ?? [];
  const dueChunks = chunkRows.filter(isChunkDue).length;
  const recentWords = recentRes.data ?? [];

  return (
    <AppShell>
      <main className="container max-w-3xl py-8 lg:py-10">
        <header className="mb-6">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">어휘</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            단어를 쌓고, 뜻을 다지고, 나만의 사전을 만들어요.
          </p>
        </header>

        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">오늘의 복습</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ReviewSummaryTile
              icon={CreditCard}
              label="플래시카드"
              due={dueFlashcards}
              total={totalFlashcards}
              href="/learn/flashcards"
              emptyLabel="추가된 카드가 없어요"
              emptyCta="첫 카드 만들러 가기"
            />
            <ReviewSummaryTile
              icon={Quote}
              label="청크"
              due={dueChunks}
              total={chunkRows.length}
              href="/learn/chunks"
              emptyLabel="담아둔 청크가 없어요"
              emptyCta="내 사전에서 담아보기"
            />
          </div>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">바로 가기</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <EntryCard
              icon={CreditCard}
              title="플래시카드"
              description="단어를 카드로 반복 복습"
              href="/learn/flashcards"
            />
            <EntryCard
              icon={Quote}
              title="청크"
              description="의미 덩어리로 표현 익히기"
              href="/learn/chunks"
            />
            <EntryCard
              icon={Library}
              title="내 사전"
              description="담아둔 단어·표현 모아보기"
              href="/learn/flashcards/dictionary"
            />
          </div>
        </section>

        {recentWords.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground">최근 추가한 단어</h2>
              <Link
                href="/learn/flashcards/dictionary"
                className="text-sm text-primary hover:underline"
              >
                전체 보기
              </Link>
            </div>
            <Card>
              <CardContent className="divide-y p-0">
                {recentWords.map((w) => (
                  <div key={w.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="truncate font-medium">{w.word}</span>
                    <span className="truncate text-sm text-muted-foreground">{w.meaning}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        )}
      </main>
    </AppShell>
  );
}

function ReviewSummaryTile({
  icon: Icon,
  label,
  due,
  total,
  href,
  emptyLabel,
  emptyCta,
}: {
  icon: typeof CreditCard;
  label: string;
  due: number;
  total: number;
  href: string;
  emptyLabel: string;
  emptyCta: string;
}) {
  if (total === 0) {
    return (
      <Link href={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Card className="h-full transition-colors hover:bg-secondary/50">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
              <Icon className="h-4.5 w-4.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{label}</p>
              <p className="truncate text-sm text-muted-foreground">{emptyLabel}</p>
            </div>
            <span className="shrink-0 text-sm font-medium text-primary">{emptyCta}</span>
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <Link href={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full transition-colors hover:bg-secondary/50">
        <CardContent className="flex flex-col gap-2 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
              <Icon className="h-4.5 w-4.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {due > 0 ? `${due}개` : "완료"}{" "}
                <span className="font-normal text-muted-foreground">{label} 복습</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {due > 0 ? "오늘 복습할 준비가 됐어요" : "오늘 복습을 모두 마쳤어요"}
              </p>
            </div>
          </div>
          <ProgressBar value={total - due} max={total} aria-label={`${label} 진행률`} />
        </CardContent>
      </Card>
    </Link>
  );
}

function EntryCard({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: typeof CreditCard;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link href={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full transition-colors hover:bg-secondary/50">
        <CardContent className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Icon className="h-4.5 w-4.5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{title}</p>
            <p className="truncate text-xs text-muted-foreground">{description}</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </CardContent>
      </Card>
    </Link>
  );
}
