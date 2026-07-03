import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { Language } from "@nativo/core";
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

  // 1) 업로드한 내 문서인지 먼저 확인 (id 가 documents 에 있으면 문서, 아니면 Gutenberg)
  const { data: doc } = await supabase
    .from("documents")
    .select("id, title, pages, total_pages, language")
    .eq("id", params.id)
    .maybeSingle();

  let title: string;
  let author: string | null = null;
  let pages: string[];
  let total: number;
  let language: Language;
  const contentType = doc ? "article" : "book";

  if (doc) {
    title = doc.title;
    pages = doc.pages;
    total = doc.total_pages;
    language = doc.language;
  } else {
    const { data: profile } = await supabase
      .from("users")
      .select("selected_language")
      .eq("id", user.id)
      .single();
    language = profile?.selected_language ?? "english";

    const book = await getBook(params.id);
    if (!book) notFound();
    author = book.authors[0]?.name ?? null;
    title = book.title;

    const url = plainTextUrl(book);
    const fetched = url ? await fetchBookPages(url) : { pages: [], total: 0 };
    pages = fetched.pages;
    total = fetched.total;

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
  }

  // 위치 기억: ?p 없이 열면 마지막으로 읽던 쪽으로 이어가기
  if (searchParams.p === undefined) {
    const { data: hist } = await supabase
      .from("content_history")
      .select("last_chapter")
      .eq("user_id", user.id)
      .eq("content_id", params.id)
      .eq("language", language)
      .maybeSingle();
    const resume = Number(hist?.last_chapter ?? "1") || 1;
    if (resume > 1) redirect(`/learn/reading/${params.id}?p=${resume}`);
  }

  const page = Math.min(Math.max(1, Number(searchParams.p ?? "1") || 1), total);
  const text = pages[page - 1] ?? "";

  // 독서 진행 기록
  await supabase.from("content_history").upsert(
    {
      user_id: user.id,
      content_type: contentType,
      content_id: params.id,
      title,
      author,
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
  const prevHref = page > 1 ? linkFor(page - 1) : null;
  const nextHref = page < total ? linkFor(page + 1) : null;

  return (
    <>
      <AppHeader />
      <main className="container max-w-6xl py-8 pb-28">
        <Link href="/learn/reading" className="text-sm text-muted-foreground hover:text-foreground">
          ← 목록
        </Link>
        <h1 className="mb-1 mt-2 line-clamp-2 text-lg font-bold">{title}</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          {page} / {total} 쪽 · 읽으면서 문장을 번역해 보세요
        </p>

        <Reader
          text={text}
          language={language}
          page={page}
          total={total}
          prevHref={prevHref}
          nextHref={nextHref}
        />

        <nav className="mt-8 flex items-center justify-between">
          {prevHref ? (
            <Link href={prevHref} className="rounded-md border px-4 py-2 text-sm hover:bg-secondary">
              ← 이전 쪽
            </Link>
          ) : (
            <span />
          )}
          {nextHref ? (
            <Link href={nextHref} className="rounded-md border px-4 py-2 text-sm hover:bg-secondary">
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
