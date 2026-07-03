"use server";

import type { CefrLevel, Language, TablesInsert } from "@nativo/core";
import { createClient } from "@/lib/supabase/server";
import { LOCAL_USER_ID } from "@/lib/db";
import { nextNewWords } from "@/lib/word-db";

/** 온보딩 직후 채울 초기 덱 크기. */
const INITIAL_DECK = 20;

/**
 * 선택 언어의 word-db(data/word-db/{lang}.json)에서 미학습 단어를
 * 빈도순·레벨 ±1로 골라 flashcards 에 초기 덱으로 채운다.
 *
 * word-db 는 서버 전용(node:fs)이라 클라이언트 온보딩에서 직접 읽을 수 없어
 * 서버 액션으로 분리한다. 이후 세션 보충(flashcards 페이지)과 동일한 출처를 쓴다.
 *
 * @returns 새로 추가된 카드 수
 */
/**
 * 온보딩 완료: 선택 언어를 저장하고 초기 덱을 시드한다.
 * (단일 사용자 로컬 모드 — 브라우저 대신 서버에서 DB 접근)
 */
export async function completeOnboarding(
  language: Language,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("users")
    .update({ selected_language: language })
    .eq("id", LOCAL_USER_ID);
  if (error) return { ok: false, error: error.message };

  try {
    await seedInitialDeck(language);
  } catch {
    // 시드 실패는 진행을 막지 않음
  }
  return { ok: true };
}

export async function seedInitialDeck(language: Language): Promise<number> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data: profile } = await supabase
    .from("users")
    .select("current_level")
    .eq("id", user.id)
    .single();
  const level = (profile?.current_level ?? "A2") as CefrLevel;

  const { data: ownedRows } = await supabase
    .from("flashcards")
    .select("word")
    .eq("user_id", user.id)
    .eq("language", language);
  const owned = new Set((ownedRows ?? []).map((r) => r.word.toLowerCase()));

  const fresh = nextNewWords(language, level, owned, INITIAL_DECK);
  if (fresh.length === 0) return 0;

  const rows: TablesInsert<"flashcards">[] = fresh.map((w) => ({
    user_id: user.id,
    language,
    word: w.word,
    meaning: w.meaning,
    meaning_en: w.meaning_en ?? null,
    pronunciation: w.pronunciation ?? null,
    example_1: w.example_1 ?? null,
    part_of_speech: w.part_of_speech ?? null,
    difficulty: w.difficulty ?? null,
    source: "curated",
  }));

  const { error } = await supabase.from("flashcards").insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}
