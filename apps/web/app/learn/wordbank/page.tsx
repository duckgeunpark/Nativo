import { redirect } from "next/navigation";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { createClient } from "@/lib/supabase/server";
import { getWordBankPage, wordBankSize } from "@/lib/wordbank";
import { WordBankList } from "./WordBankList";

export default async function WordBankPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
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
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);
  const result = getWordBankPage(language, { query: q, page });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  const { data: existingRows } = await supabase
    .from("flashcards")
    .select("word")
    .eq("user_id", user.id)
    .eq("language", language);
  const existing = (existingRows ?? []).map((r) => r.word);

  const linkFor = (p: number) =>
    `/learn/wordbank?q=${encodeURIComponent(q)}&page=${p}`;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-6">
        <Link href="/learn/flashcards" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← 플래시카드
        </Link>
        <h1 className="mt-2 text-2xl font-bold">단어 은행</h1>
        <p className="mt-1 text-sm text-neutral-600">
          빈도순 {wordBankSize(language).toLocaleString()}개 단어. 추가하면 뜻·발음이 자동으로 채워집니다.
        </p>
      </header>

      <form className="mb-4 flex gap-2" action="/learn/wordbank" method="get">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="단어 검색…"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2"
        />
        <button
          type="submit"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition hover:opacity-90"
        >
          검색
        </button>
      </form>

      <p className="mb-3 text-sm text-neutral-500">
        {result.total.toLocaleString()}개 결과 · {page}/{totalPages} 페이지
      </p>

      {result.words.length > 0 ? (
        <WordBankList words={result.words} existing={existing} language={language} />
      ) : (
        <p className="rounded-lg border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500">
          검색 결과가 없습니다.
        </p>
      )}

      <nav className="mt-6 flex items-center justify-between">
        {page > 1 ? (
          <Link href={linkFor(page - 1)} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50">
            ← 이전
          </Link>
        ) : (
          <span />
        )}
        {page < totalPages ? (
          <Link href={linkFor(page + 1)} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50">
            다음 →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
