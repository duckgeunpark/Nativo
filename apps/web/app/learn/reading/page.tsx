import { redirect } from "next/navigation";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import { searchBooks } from "@/lib/gutenberg";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function ReadingPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
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

  const q = searchParams.q ?? "";
  const books = await searchBooks(language, q);

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

  return (
    <>
      <AppHeader />
      <main className="container max-w-2xl py-10">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">문서 읽기</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            저작권이 만료된 원서를 읽고, 모르는 단어를 눌러 뜻을 보고 카드에 담으세요. (Project Gutenberg)
          </p>
        </header>

        {inProgress && inProgress.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">이어 읽기</h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {inProgress.map((h) => (
                <li key={h.content_id}>
                  <Link href={`/learn/reading/${h.content_id}?p=${Number(h.last_chapter ?? "1") || 1}`}>
                    <Card className="h-full transition-colors hover:bg-secondary/40">
                      <CardContent className="p-4">
                        <p className="line-clamp-2 font-medium">{h.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {h.last_chapter ?? 1}
                          {h.total_chapters ? ` / ${h.total_chapters}` : ""} 쪽
                          {" · "}
                          {h.progress_pct}%
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <form className="mb-6 flex gap-2" action="/learn/reading" method="get">
          <Input name="q" defaultValue={q} placeholder="제목·작가 검색 (예: Tom Sawyer)" />
          <Button type="submit">검색</Button>
        </form>

        {books.length > 0 ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {books.map((b) => (
              <li key={b.id}>
                <Link href={`/learn/reading/${b.id}`}>
                  <Card className="h-full transition-colors hover:bg-secondary/40">
                    <CardContent className="p-4">
                      <p className="line-clamp-2 font-medium">{b.title}</p>
                      <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                        {b.authors[0]?.name ?? "작자 미상"}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              검색 결과가 없습니다. 다른 검색어를 시도해 보세요.
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
