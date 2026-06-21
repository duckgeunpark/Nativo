import { redirect } from "next/navigation";
import Link from "next/link";
import type { CefrLevel, ChunkCategory, Language } from "@nativo/core";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABEL } from "@/lib/chunks";
import { getChunkDbPage, chunkDbSize } from "@/lib/chunk-db";
import { cn } from "@/lib/utils";
import { ChunkDictionary, type ChunkRow } from "./ChunkDictionary";
import { AllChunksList } from "./AllChunksList";
import { ChunkGenerator } from "./ChunkGenerator";

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
    <>
      <AppHeader />
      <main className="container max-w-2xl py-10">
        <header className="mb-5">
          <h1 className="text-2xl font-bold">내 청크 사전</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            하트로 담은 내 청크, 학습한 청크, 전체 청크 목록을 볼 수 있어요.
          </p>
        </header>

        <nav className="mb-5 flex gap-1 border-b">
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

  return (
    <div>
      <form className="mb-3 flex flex-wrap gap-2" action={BASE} method="get">
        <input type="hidden" name="tab" value="all" />
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="표현·뜻 검색…"
          className="min-w-40 flex-1 rounded-md border px-3 py-2 text-sm"
        />
        <select name="category" defaultValue={cat} className="rounded-md border px-2 py-2 text-sm">
          <option value="all">전체 분류</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c] ?? c}
            </option>
          ))}
        </select>
        <select name="level" defaultValue={lv} className="rounded-md border px-2 py-2 text-sm">
          <option value="all">전체 레벨</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          검색
        </button>
      </form>
      <p className="mb-3 text-sm text-muted-foreground">
        {result.total.toLocaleString()}개 · {page}/{totalPages} 페이지 (전체{" "}
        {chunkDbSize(language).toLocaleString()})
      </p>

      <AllChunksList chunks={result.chunks} language={language} owned={owned} />

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
