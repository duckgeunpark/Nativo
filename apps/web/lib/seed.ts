/**
 * 기본 단어장을 사용자 flashcards 에 채워 넣는 공용 헬퍼.
 * 온보딩(언어 선택 시 자동) + 수동 버튼 양쪽에서 재사용.
 */

import type { Language, NativoClient, TablesInsert } from "@nativo/core";
import { SEED_WORDS } from "./seed-words";

/**
 * 해당 언어의 큐레이션 단어 중 아직 없는 것만 insert.
 * @returns 새로 추가된 카드 수
 */
export async function seedDefaultDeck(
  supabase: NativoClient,
  userId: string,
  language: Language,
): Promise<number> {
  const seeds = SEED_WORDS[language] ?? [];
  if (seeds.length === 0) return 0;

  const { data: existing } = await supabase
    .from("flashcards")
    .select("word")
    .eq("user_id", userId)
    .eq("language", language);
  const have = new Set((existing ?? []).map((r) => r.word));

  const rows: TablesInsert<"flashcards">[] = seeds
    .filter((s) => !have.has(s.word))
    .map((s) => ({
      user_id: userId,
      language,
      word: s.word,
      meaning: s.meaning,
      meaning_en: s.meaning_en ?? null,
      pronunciation: s.pronunciation ?? null,
      example_1: s.example_1 ?? null,
      part_of_speech: s.part_of_speech ?? null,
      difficulty: s.difficulty ?? null,
      source: "curated",
    }));

  if (rows.length === 0) return 0;

  const { error } = await supabase.from("flashcards").insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}
