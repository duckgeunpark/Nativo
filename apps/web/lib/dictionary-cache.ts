/**
 * 단어 조회 캐시 (dictionary_cache 테이블). 서버 전용.
 *
 * 조회 순서: 정적 word-db(JSON) → 이 캐시 → DeepL/사전 API → 결과를 여기 저장.
 * word-db.ts 처럼 supabase 어댑터를 거치지 않고 libSQL 을 직접 쓴다
 * (언어별 공용 캐시라 user_id 가 없고, 어댑터 타입에 테이블을 추가할 필요가 없다).
 */

import { randomUUID } from "node:crypto";
import type { Language } from "@nativo/core";
import { ensureReady, getDb } from "./db/client";
import type { EnrichedFields } from "./dictionary";

/** 캐시에 저장/조회되는 단어 정보 + 출처. */
export interface CachedWord extends Partial<EnrichedFields> {
  source: "deepl" | "ai";
}

/** 정적 word-db 의 SeedWord 와 구조 호환되는 캐시 단어(난이도 없음). */
export interface CachedSeedWord {
  word: string;
  meaning: string;
  meaning_en?: string;
  pronunciation?: string;
  example_1?: string;
  part_of_speech?: string;
}

/** 언어별 소문자 정규화 키. */
function normalize(word: string): string {
  return word.trim().toLowerCase();
}

/**
 * 언어별 캐시된 단어 전체 목록(뜻 포함, 최신 저장 순).
 * '전체 목록' 탭에서 정적 word-db 와 합쳐 브라우징 사전을 키우는 데 쓴다.
 */
export async function listCachedWords(
  language: Language,
): Promise<CachedSeedWord[]> {
  await ensureReady();
  const db = getDb();
  const rs = await db.execute({
    sql: `SELECT word, meaning, meaning_en, pronunciation, example_1, part_of_speech
          FROM dictionary_cache WHERE language = ? ORDER BY created_at DESC`,
    args: [language],
  });
  return rs.rows
    .map((r) => {
      const row = r as {
        word?: string;
        meaning?: string;
        meaning_en?: string | null;
        pronunciation?: string | null;
        example_1?: string | null;
        part_of_speech?: string | null;
      };
      return {
        word: row.word ?? "",
        meaning: row.meaning ?? "",
        meaning_en: row.meaning_en ?? undefined,
        pronunciation: row.pronunciation ?? undefined,
        example_1: row.example_1 ?? undefined,
        part_of_speech: row.part_of_speech ?? undefined,
      };
    })
    .filter((w) => w.word && w.meaning);
}

/** 캐시에서 단어를 정확히(대소문자 무시) 조회. 없으면 null. */
export async function getCachedWord(
  language: Language,
  word: string,
): Promise<CachedWord | null> {
  const key = normalize(word);
  if (!key) return null;

  await ensureReady();
  const db = getDb();
  const rs = await db.execute({
    sql: `SELECT meaning, meaning_en, pronunciation, example_1, part_of_speech, source
          FROM dictionary_cache WHERE language = ? AND word = ? LIMIT 1`,
    args: [language, key],
  });
  const row = rs.rows[0] as
    | {
        meaning?: string;
        meaning_en?: string | null;
        pronunciation?: string | null;
        example_1?: string | null;
        part_of_speech?: string | null;
        source?: string;
      }
    | undefined;
  if (!row?.meaning) return null;

  return {
    meaning: row.meaning,
    meaning_en: row.meaning_en ?? undefined,
    pronunciation: row.pronunciation ?? undefined,
    example_1: row.example_1 ?? undefined,
    part_of_speech: row.part_of_speech ?? undefined,
    source: row.source === "ai" ? "ai" : "deepl",
  };
}

/**
 * 조회 결과를 캐시에 저장. meaning 이 없으면 저장하지 않는다(뜻 없는 캐시는 무의미).
 * 동시 쓰기/재조회 대비 UNIQUE(language, word) 충돌 시 무시(첫 저장 유지).
 */
export async function putCachedWord(
  language: Language,
  word: string,
  data: CachedWord,
): Promise<void> {
  const key = normalize(word);
  if (!key || !data.meaning) return;

  await ensureReady();
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO dictionary_cache
            (id, language, word, meaning, meaning_en, pronunciation, example_1, part_of_speech, source)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(language, word) DO NOTHING`,
    args: [
      randomUUID(),
      language,
      key,
      data.meaning,
      data.meaning_en ?? null,
      data.pronunciation ?? null,
      data.example_1 ?? null,
      data.part_of_speech ?? null,
      data.source,
    ],
  });
}
