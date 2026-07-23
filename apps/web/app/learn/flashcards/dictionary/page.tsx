import { redirect } from "next/navigation";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { CefrLevel, Language } from "@nativo/core";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { getWordDbPageWithCache } from "@/lib/word-db";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WordDictionary, type WordRow } from "./WordDictionary";
import { AllWordsList } from "./AllWordsList";
import { SearchInput } from "./SearchInput";

const BASE = "/learn/flashcards/dictionary";
const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default async function WordDictionaryPage({
  searchParams,
}: {
  searchParams: { tab?: string; q?: string; level?: string; page?: string };
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
    <AppShell>
      <main className="container py-8 md:py-10">
        <header className="mb-5">
          <h1 className="font-display text-2xl font-bold text-foreground">내 단어 사전</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            직접 추가한 내 단어, 학습한 단어, 전체 단어 목록을 볼 수 있어요.
          </p>
        </header>

        <nav
          aria-label="사전 탭"
          className="mb-5 grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-secondary p-1"
        >
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
            level={searchParams.level}
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
    </AppShell>
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
      aria-current={active ? "page" : undefined}
      className={cn(
        "truncate rounded-full px-3 py-1.5 text-center text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-primary font-medium text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
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

/**
 * 전체 목록 = 정적 word-db/{language}.json + dictionary_cache(DeepL/사전으로 찾은 단어).
 * 검색·페이지네이션 + 내 단어 추가. 캐시 단어가 쌓일수록 목록이 자란다.
 */
async function AllTab({
  userId,
  language,
  q,
  level,
  page,
}: {
  userId: string;
  language: Language;
  q: string;
  level?: string;
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

  const lv = (LEVELS.includes(level as CefrLevel) ? level : "all") as CefrLevel | "all";

  const result = await getWordDbPageWithCache(language, { query: q, level: lv, page });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const linkFor = (p: number) =>
    `${BASE}?tab=all&q=${encodeURIComponent(q)}&level=${lv}&page=${p}`;

  const hasFilter = !!q || lv !== "all";

  return (
    <div>
      <form className="mb-4 flex flex-wrap gap-2" action={BASE} method="get">
        <input type="hidden" name="tab" value="all" />
        <SearchInput name="q" defaultValue={q} placeholder="단어·뜻 검색…" />
        <select
          name="level"
          defaultValue={lv}
          className="rounded-md border border-input bg-background px-2 py-2 text-sm shadow-sm"
        >
          <option value="all">전체 레벨</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary" className="shrink-0">
          <Search className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">검색</span>
        </Button>
      </form>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {result.total.toLocaleString()}개 단어 · {page}/{totalPages} 페이지
          {hasFilter ? "" : ` (전체 ${result.grandTotal.toLocaleString()})`}
        </p>
        <PageNav page={page} totalPages={totalPages} linkFor={linkFor} />
      </div>

      <AllWordsList words={result.words} language={language} owned={owned} hasQuery={hasFilter} />

      <div className="mt-6 flex justify-end">
        <PageNav page={page} totalPages={totalPages} linkFor={linkFor} />
      </div>
    </div>
  );
}

/** 이전/다음 페이지 버튼 쌍 — 목록 위(오른쪽)와 아래에 동일하게 노출. */
function PageNav({
  page,
  totalPages,
  linkFor,
}: {
  page: number;
  totalPages: number;
  linkFor: (p: number) => string;
}) {
  return (
    <nav className="flex shrink-0 items-center gap-2" aria-label="페이지 이동">
      {page > 1 ? (
        <Button asChild variant="outline" size="sm">
          <Link href={linkFor(page - 1)}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
            이전
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          <ChevronLeft className="h-4 w-4" aria-hidden />
          이전
        </Button>
      )}
      {page < totalPages ? (
        <Button asChild variant="outline" size="sm">
          <Link href={linkFor(page + 1)}>
            다음
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          다음
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      )}
    </nav>
  );
}
