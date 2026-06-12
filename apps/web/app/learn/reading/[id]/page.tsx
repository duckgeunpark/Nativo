import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import { getBook, plainTextUrl, fetchBookPages } from "@/lib/gutenberg";
import { Card, CardContent } from "@/components/ui/card";
import { Reader } from "./Reader";

export default async function BookReaderPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { p?: string };
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

  const book = await getBook(params.id);
  if (!book) notFound();

  const url = plainTextUrl(book);
  const { pages, total } = url ? await fetchBookPages(url) : { pages: [], total: 0 };

  if (total === 0) {
    return (
      <>
        <AppHeader />
        <main className="container max-w-2xl py-10">
          <Link href="/learn/reading" className="text-sm text-muted-foreground hover:text-foreground">
            ← 목록
          </Link>
          <Card className="mt-4">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              이 책의 본문(텍스트)을 불러올 수 없습니다. 다른 책을 선택해 주세요.
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  const page = Math.min(Math.max(1, Number(searchParams.p ?? "1") || 1), total);
  const text = pages[page - 1] ?? "";

  // 독서 진행 기록
  await supabase.from("content_history").upsert(
    {
      user_id: user.id,
      content_type: "book",
      content_id: params.id,
      title: book.title,
      author: book.authors[0]?.name ?? null,
      language,
      total_chapters: total,
      completed_chapters: page,
      last_chapter: String(page),
      progress_pct: total ? Math.round((page / total) * 1000) / 10 : 0,
      completed: page >= total,
    },
    { onConflict: "user_id,content_id,language" },
  );

  const linkFor = (p: number) => `/learn/reading/${params.id}?p=${p}`;

  return (
    <>
      <AppHeader />
      <main className="container max-w-2xl py-8 pb-28">
        <Link href="/learn/reading" className="text-sm text-muted-foreground hover:text-foreground">
          ← 목록
        </Link>
        <h1 className="mb-1 mt-2 line-clamp-2 text-lg font-bold">{book.title}</h1>
        <p className="mb-5 text-sm text-muted-foreground">
          {page} / {total} 쪽 · 단어를 누르면 뜻이 나와요
        </p>

        <Reader text={text} language={language} />

        <nav className="mt-8 flex items-center justify-between">
          {page > 1 ? (
            <Link href={linkFor(page - 1)} className="rounded-md border px-4 py-2 text-sm hover:bg-secondary">
              ← 이전 쪽
            </Link>
          ) : (
            <span />
          )}
          {page < total ? (
            <Link href={linkFor(page + 1)} className="rounded-md border px-4 py-2 text-sm hover:bg-secondary">
              다음 쪽 →
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">끝까지 읽었어요 🎉</span>
          )}
        </nav>
      </main>
    </>
  );
}
