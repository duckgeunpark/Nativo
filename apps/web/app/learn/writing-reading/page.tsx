import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, Languages, NotebookPen, Sparkles, ChevronRight } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";

export default async function WritingReadingHubPage() {
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

  const [readingRes, translateRes, journalRes] = await Promise.all([
    supabase
      .from("content_history")
      .select("content_id, title, progress_pct, started_at")
      .eq("user_id", user.id)
      .eq("language", language)
      .eq("content_type", "book")
      .eq("completed", false)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("translation_sessions")
      .select("id, score_total, created_at")
      .eq("user_id", user.id)
      .eq("language", language)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("writing_journal")
      .select("id, entry_date, word_count")
      .eq("user_id", user.id)
      .eq("language", language)
      .order("entry_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const reading = readingRes.data;
  const translation = translateRes.data;
  const journal = journalRes.data;

  return (
    <AppShell>
      <main className="container py-8 lg:py-10">
        <header className="mb-6">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">쓰기·읽기</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            읽고, 옮기고, 써 보며 문해력을 키워요.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SummaryCard
            icon={BookOpen}
            title="읽기"
            metric={reading ? (reading.title ?? "읽던 책") : "읽고 있는 책이 없어요"}
            sub={reading ? `${reading.progress_pct ?? 0}% 읽음` : undefined}
            date={reading?.started_at ?? null}
            cta={reading ? "이어 읽기" : "책 찾아보기"}
            href={reading ? `/learn/reading/${reading.content_id}` : "/learn/reading"}
          />
          <SummaryCard
            icon={Languages}
            title="번역가"
            metric={
              translation?.score_total != null
                ? `최근 점수 ${translation.score_total}점`
                : "번역 기록이 없어요"
            }
            date={translation?.created_at ?? null}
            cta={translation ? "이어서 번역하기" : "번역 시작하기"}
            href="/learn/translate"
          />
          <SummaryCard
            icon={NotebookPen}
            title="영작 일기"
            metric={journal ? `${journal.word_count}단어 작성` : "작성한 일기가 없어요"}
            date={journal?.entry_date ?? null}
            cta={journal ? "일기 이어 쓰기" : "오늘 일기 쓰기"}
            href="/learn/journal"
          />
          <SummaryCard
            icon={Sparkles}
            title="뉘앙스 퀴즈"
            metric="풀이 기록은 저장되지 않아요"
            date={null}
            cta="퀴즈 풀어보기"
            href="/learn/nuance"
          />
        </div>
      </main>
    </AppShell>
  );
}

function SummaryCard({
  icon: Icon,
  title,
  metric,
  sub,
  date,
  cta,
  href,
}: {
  icon: typeof BookOpen;
  title: string;
  metric: string;
  sub?: string;
  date: string | null;
  cta: string;
  href: string;
}) {
  return (
    <Link href={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full transition-colors hover:bg-secondary/50">
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Icon className="h-4.5 w-4.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-muted-foreground">{title}</p>
              <p className="truncate font-medium">{metric}</p>
              {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t pt-3 text-sm">
            <span className="text-xs text-muted-foreground">
              {date ? date.slice(0, 10) : "기록 없음"}
            </span>
            <span className="inline-flex items-center gap-1 font-medium text-primary">
              {cta}
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
