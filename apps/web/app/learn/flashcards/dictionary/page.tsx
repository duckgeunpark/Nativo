import { redirect } from "next/navigation";
import Link from "next/link";
import type { Language } from "@nativo/core";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import { getWordDbPage, wordDbSize } from "@/lib/word-db";
import { cn } from "@/lib/utils";
import { WordDictionary, type WordRow } from "./WordDictionary";
import { AllWordsList } from "./AllWordsList";

const BASE = "/learn/flashcards/dictionary";

export default async function WordDictionaryPage({
  searchParams,
}: {
  searchParams: { tab?: string; q?: string; page?: string };
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

  const tab =
    searchParams.tab === "all"
      ? "all"
      : searchParams.tab === "studied"
        ? "studied"
        : "mine";

  return (
    <>
      <AppHeader />
      <main className="container max-w-2xl py-10">
        <header className="mb-5">
          <h1 className="text-2xl font-bold">내 단어 사전</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            직접 추가한 내 단어, 학습한 단어, 전체 단어 목록을 볼 수 있어요.
          </p>
        </header>

        <nav className="mb-5 flex gap-1 border-b">
          <TabLink href={BASE} active={tab === "mine"}>
            내 단어
          </TabLink>
          <TabLink href={`${BASE}?tab=studied`} active={tab === "studied"}>
            학습 단어
          </TabLink>
          <TabLink href={`${BASE}?tab=all`} active={tab === "all"}>
            전체 목록
          </TabLink>
        </nav>

        {tab === "all" ? (
          <AllTab
            userId={user.id}
            language={language}
            q={searchParams.q ?? ""}
            page={Math.max(1, Number(searchParams.page ?? "1") || 1)}
          />
        ) : (
          <FlashcardsTab
            userId={user.id}
            language={language}
            variant={tab === "mine" ? "mine" : "studied"}
          />
        )}
      </main>
    </>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

/**
 * 플래시카드 기반 탭.
 * - variant="mine"    → "내 단어": 사용자가 + 로 추가한 것(source != 'curated'). 삭제 O, + X.
 * - variant="studied" → "학습 단어": 플래시카드에서 학습(1회+ 복습, last_grade 있음)한 것. + O, 삭제 X.
 * 완료 여부는 카드에 배지로 표시. 뜻 수정 가능.
 */
async function FlashcardsTab({
  userId,
  language,
  variant,
}: {
  userId: string;
  language: Language;
  variant: "mine" | "studied";
}) {
  const supabase = createClient();
  let query = supabase
    .from("flashcards")
    .select(
      "id, word, meaning, pronunciation, difficulty, language, repetitions, last_grade, source",
    )
    .eq("user_id", userId)
    .eq("language", language);
  if (variant === "mine") {
    query = query.neq("source", "curated"); // 내 단어 = 하트로 추가한 단어
  } else {
    query = query.not("last_grade", "is", null); // 학습 단어 = 한 번이라도 학습(복습)한 단어
  }

  const { data: words } = await query
    .order("repetitions", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<WordRow[]>();

  return (
    <WordDictionary
      key={variant} // 탭(내 단어/학습 단어) 전환 시 강제 remount → 이전 데이터 잔존 방지
      initial={words ?? []}
      language={language}
      removeOnUnheart={variant === "mine"}
      emptyText={
        variant === "mine"
          ? "아직 내 단어가 없어요. 전체 목록·학습 단어에서 하트를 눌러 추가하세요."
          : "아직 학습한 단어가 없어요. 플래시카드에서 학습하면 여기에 쌓여요."
      }
    />
  );
}

/** 전체 단어 = word-db/{language}.json (뜻 포함, 빈도순). 검색·페이지네이션 + 내 단어 추가. */
async function AllTab({
  userId,
  language,
  q,
  page,
}: {
  userId: string;
  language: Language;
  q: string;
  page: number;
}) {
  const supabase = createClient();
  // 이미 '내 단어'(직접 추가 = source != curated)인 단어만 ✓ 처리 → curated 단어는 + 로 추가 가능
  const { data: ownedRows } = await supabase
    .from("flashcards")
    .select("word")
    .eq("user_id", userId)
    .eq("language", language)
    .neq("source", "curated");
  const owned = (ownedRows ?? []).map((r) => r.word);

  const result = getWordDbPage(language, { query: q, page });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const linkFor = (p: number) =>
    `${BASE}?tab=all&q=${encodeURIComponent(q)}&page=${p}`;

  return (
    <div>
      <form className="mb-4 flex gap-2" action={BASE} method="get">
        <input type="hidden" name="tab" value="all" />
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="단어·뜻 검색…"
          className="flex-1 rounded-md border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          검색
        </button>
      </form>

      <p className="mb-3 text-sm text-muted-foreground">
        {result.total.toLocaleString()}개 단어 · {page}/{totalPages} 페이지
        {q ? "" : ` (전체 ${wordDbSize(language).toLocaleString()})`}
      </p>

      <AllWordsList words={result.words} language={language} owned={owned} />

      <nav className="mt-6 flex items-center justify-between">
        {page > 1 ? (
          <Link
            href={linkFor(page - 1)}
            className="rounded-md border px-4 py-2 text-sm transition hover:bg-secondary"
          >
            ← 이전
          </Link>
        ) : (
          <span />
        )}
        {page < totalPages ? (
          <Link
            href={linkFor(page + 1)}
            className="rounded-md border px-4 py-2 text-sm transition hover:bg-secondary"
          >
            다음 →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
