import { redirect } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { createClient } from "@/lib/supabase/server";
import { searchBooks } from "@/lib/gutenberg";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { UploadDocForm } from "./UploadDocForm";
import { DocListItem } from "./DocListItem";
import { DocCover } from "./DocCover";

export default async function ReadingPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  if (!isSupabaseConfigured()) {
    return (
      <AppShell>
        <main className="container flex min-h-[60vh] items-center justify-center py-10">
          <SupabaseNotice />
        </main>
      </AppShell>
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

  const q = searchParams.q ?? "";
  const { books, failed: searchFailed } = await searchBooks(language, q);

  // 이어 읽기: 진행 중인 책 (최근 순)
  const { data: inProgress } = await supabase
    .from("content_history")
    .select("content_id, title, author, last_chapter, total_chapters, progress_pct")
    .eq("user_id", user.id)
    .eq("language", language)
    .eq("content_type", "book")
    .eq("completed", false)
    .order("started_at", { ascending: false })
    .limit(4);

  // 내가 올린 문서 (PDF 등)
  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, total_pages")
    .eq("user_id", user.id)
    .eq("language", language)
    .order("created_at", { ascending: false });

  return (
    <AppShell>
      <main className="container py-8 sm:py-10">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">읽기</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              원서(Project Gutenberg)나 <b>내 PDF</b>를 읽고, 모르는 단어를 눌러 뜻을 보고 카드에 담으세요.
            </p>
          </div>
          <UploadDocForm language={language} />
        </header>

        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">내 문서</h2>
          {docs && docs.length > 0 ? (
            <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {docs.map((d) => (
                <li key={d.id}>
                  <DocListItem id={d.id} title={d.title} totalPages={d.total_pages} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon="📄"
              title="아직 올린 문서가 없어요"
              description="PDF를 끌어다 놓거나 위의 버튼으로 첫 문서를 올려보세요."
            />
          )}
        </section>

        {inProgress && inProgress.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">이어 읽기</h2>
            <ul className="flex gap-4 overflow-x-auto pb-2">
              {inProgress.map((h) => (
                <li key={h.content_id} className="w-[220px] shrink-0 sm:w-[240px]">
                  <Card className="h-full">
                    <CardContent className="flex h-full flex-col gap-3 p-4">
                      <div className="flex gap-3">
                        <DocCover title={h.title} className="w-16 shrink-0" />
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-medium">{h.title}</p>
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            {h.last_chapter ?? 1}
                            {h.total_chapters ? ` / ${h.total_chapters}` : ""} 쪽
                          </p>
                        </div>
                      </div>
                      <div className="mt-auto space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>진행률</span>
                          <span className="tabular-nums">{h.progress_pct}%</span>
                        </div>
                        <ProgressBar value={h.progress_pct ?? 0} tone="highlight" />
                        <Button asChild size="sm" className="w-full">
                          <Link
                            href={`/learn/reading/${h.content_id}?p=${Number(h.last_chapter ?? "1") || 1}`}
                          >
                            이어 읽기
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Gutenberg 원서</h2>
          <form className="mb-4 flex gap-2" action="/learn/reading" method="get">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                name="q"
                defaultValue={q}
                placeholder="제목·작가 검색 (예: Tom Sawyer)"
                className="pl-9"
              />
            </div>
            <Button type="submit">검색</Button>
          </form>

          {searchFailed ? (
            <EmptyState
              icon="⚠️"
              title="책 목록을 불러오지 못했어요"
              description="네트워크 문제일 수 있어요. 잠시 후 다시 시도해 주세요."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href={`/learn/reading${q ? `?q=${encodeURIComponent(q)}` : ""}`}>
                    다시 시도
                  </Link>
                </Button>
              }
            />
          ) : books.length > 0 ? (
            <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {books.map((b) => (
                <li key={b.id}>
                  <Link href={`/learn/reading/${b.id}`} className="block">
                    <DocCover
                      title={b.title}
                      badge="EPUB"
                      className="shadow-sm transition-transform hover:-translate-y-0.5"
                    />
                    <p className="mt-2 line-clamp-2 text-sm font-medium">{b.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {b.authors[0]?.name ?? "작자 미상"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon="🔍"
              title="검색 결과가 없어요"
              description="다른 검색어를 시도하거나 철자를 확인해 보세요."
            />
          )}
        </section>
      </main>
    </AppShell>
  );
}
