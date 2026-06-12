"use server";

import { revalidatePath } from "next/cache";
import type { CefrLevel, Language, TablesInsert } from "@nativo/core";
import { createClient } from "@/lib/supabase/server";

/** 내 단어 사전 라우트 — 토글 후 캐시 무효화로 모든 탭이 즉시 최신 반영. */
const DICT_PATH = "/learn/flashcards/dictionary";

export interface AddWordInput {
  language: Language;
  word: string;
  meaning: string;
  pronunciation?: string | null;
  example_1?: string | null;
  part_of_speech?: string | null;
  difficulty?: string | null;
}

/**
 * 단어를 '내 단어'(source='manual')로 추가한다.
 * 이미 덱에 있으면 source 만 'manual' 로 바꿔 '내 단어' 탭에 모이게 한다.
 * (word-db 단어는 뜻·발음 등을 그대로 넣어 새 카드로 만든다.)
 */
export async function addToMyWords(
  input: AddWordInput,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const { data: existing } = await supabase
    .from("flashcards")
    .select("id")
    .eq("user_id", user.id)
    .eq("language", input.language)
    .eq("word", input.word)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("flashcards")
      .update({ source: "manual" })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(DICT_PATH);
    return { ok: true };
  }

  const row: TablesInsert<"flashcards"> = {
    user_id: user.id,
    language: input.language,
    word: input.word,
    meaning: input.meaning,
    pronunciation: input.pronunciation ?? null,
    example_1: input.example_1 ?? null,
    part_of_speech: input.part_of_speech ?? null,
    difficulty: (input.difficulty as CefrLevel | null) ?? null,
    source: "manual",
  };
  const { error } = await supabase.from("flashcards").insert(row);
  if (error) return { ok: false, error: error.message };
  revalidatePath(DICT_PATH);
  return { ok: true };
}

/**
 * '내 단어'에서 제거 = source 를 'curated' 로 되돌려 '내 단어'(source != curated) 목록에서 빠지게 한다.
 * 카드 자체는 삭제하지 않음(학습 단어로는 남음).
 */
export async function removeFromMyWords(input: {
  language: Language;
  word: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("flashcards")
    .update({ source: "curated" })
    .eq("user_id", user.id)
    .eq("language", input.language)
    .eq("word", input.word);
  if (error) return { ok: false, error: error.message };
  revalidatePath(DICT_PATH);
  return { ok: true };
}
