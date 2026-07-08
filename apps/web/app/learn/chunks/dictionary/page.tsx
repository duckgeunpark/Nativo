import { redirect } from "next/navigation";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { CefrLevel, ChunkCategory, Language } from "@nativo/core";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABEL } from "@/lib/chunks";
import { getChunkDbPage, chunkDbSize } from "@/lib/chunk-db";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChunkDictionary, type ChunkRow } from "./ChunkDictionary";
import { AllChunksList } from "./AllChunksList";
import { ChunkGenerator } from "./ChunkGenerator";
import { SearchInput } from "@/app/learn/flashcards/dictionary/SearchInput";

const BASE = "/learn/chunks/dictionary";
const CHUNK_COLS =
  "id, expression, translation_ko, situation, nuance, example_1, example_2, category, level, review_count, source";
const CATEGORIES: ChunkCategory[] = ["daily", "business", "travel", "social"];
const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default async function ChunkDictionaryPage({
  searchParams,
}: {
  searchParams: { tab?: string; q?: string; category?: string; level?: string; page?: string };
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
    .select("selected_language, current_level")
    .eq("id", user.id)
    .single();
  const language = profile?.selected_language ?? "english";
  const level = (profile?.current_level ?? "B1") as CefrLevel;

  const tab =
    searchParams.tab === "all" ? "all" : searchParams.tab === "studied" ? "studied" : "mine";

  return (
    <AppShell>
      <main className="container py-8 md:py-10">
        <header className="mb-5">
          <h1 className="font-display text-2xl font-bold text-foreground">내 청크 사전</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            하트로 담은 내 청크, 학습한 청크, 전체 청크 목록을 볼 수 있어요.
          </p>
        </header>

        <nav
          aria-label="사전 탭"
          className="mb-5 grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-secondary p-1"
        >
          <TabLink href={BASE} active={tab === "mine"}>
            내 청크
          </TabLink>
          <TabLink href={`${BASE}?tab=studied`} active={tab === "studied"}>
            학습 청크
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
            category={searchParams.category}
            level={searchParams.level}
            page={Math.max(1, Number(searchParams.page ?? "1") || 1)}
          />
        ) : (
          <MineOrStudiedTab
            key={tab}
            userId={user.id}
            language={language}
            level={level}
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

/** 내 청크(source!=curated, 하트해제 시 제거) / 학습 청크(1회+ 복습). */
async function MineOrStudiedTab({
  userId,
  language,
  level,
  variant,
}: {
  userId: string;
  language: Language;
  level: CefrLevel;
  variant: "mine" | "studied";
}) {
  const supabase = createClient();
  let query = supabase
    .from("chunks")
    .select(CHUNK_COLS)
    .eq("user_id", userId)
    .eq("language", language);
  if (variant === "mine") query = query.eq("source", "manual"); // 내 청크 = 하트로 담은 것만
  else query = query.not("last_reviewed_at", "is", null); // 학습 청크 = 1회+ 복습

  const { data: chunks } = await query
    .order("review_count", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<ChunkRow[]>();

  return (
    <>
      {variant === "mine" && <ChunkGenerator language={language} level={level} />}
      <ChunkDictionary
        initial={chunks ?? []}
        language={language}
        removeOnUnheart={variant === "mine"}
        emptyText={
          variant === "mine"
            ? "아직 내 청크가 없어요. 전체 목록·학습 청크에서 하트를 눌러 담거나, 위에서 AI로 생성해 보세요."
            : "아직 학습한 청크가 없어요. 청크 복습을 하면 여기에 쌓여요."
        }
      />
    </>
  );
}

/** 전체 목록 = chunk-db (검색·분류·레벨·페이지네이션 + 하트). */
async function AllTab({
  userId,
  language,
  q,
  category,
  level,
  page,
}: {
  userId: string;
  language: Language;
  q: string;
  category?: string;
  level?: string;
  page: number;
}) {
  const supabase = createClient();
  const { data: ownedRows } = await supabase
    .from("chunks")
    .select("expression")
    .eq("user_id", userId)
    .eq("language", language)
    .eq("source", "manual"); // 하트로 담은 것만 ♥ 표시
  const owned = (ownedRows ?? []).map((r) => r.expression);

  const cat = (CATEGORIES.includes(category as ChunkCategory) ? category : "all") as
    | ChunkCategory
    | "all";
  const lv = (LEVELS.includes(level as CefrLevel) ? level : "all") as CefrLevel | "all";

  const result = getChunkDbPage(language, { query: q, category: cat, level: lv, page });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const linkFor = (p: number) =>
    `${BASE}?tab=all&q=${encodeURIComponent(q)}&category=${cat}&level=${lv}&page=${p}`;

  const hasFilter = !!q || cat !== "all" || lv !== "all";

  return (
    <div>
      <form className="mb-3 flex flex-wrap gap-2" action={BASE} method="get">
        <input type="hidden" name="tab" value="all" />
        <SearchInput name="q" defaultValue={q} placeholder="표현·뜻 검색…" />
        <select
          name="category"
          defaultValue={cat}
          className="rounded-md border border-input bg-background px-2 py-2 text-sm shadow-sm"
        >
          <option value="all">전체 분류</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c] ?? c}
            </option>
          ))}
        </select>
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
          {result.total.toLocaleString()}개 · {page}/{totalPages} 페이지 (전체{" "}
          {chunkDbSize(language).toLocaleString()})
        </p>
        <PageNav page={page} totalPages={totalPages} linkFor={linkFor} />
      </div>

      <AllChunksList chunks={result.chunks} language={language} owned={owned} hasQuery={hasFilter} />

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
