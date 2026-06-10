/**
 * 기본 제공 단어장(큐레이션) 로더.
 *
 * 실제 단어 데이터는 유지보수 편의를 위해 언어별 JSON 자산으로 분리:
 *   data/seed-words/{english,spanish,japanese}.json
 * 이 모듈은 그 JSON 을 SeedWord 타입으로 묶어 제공만 한다.
 *
 * 온보딩에서 언어 선택 시 flashcards 에 source='curated' 로 자동 복사된다.
 * (향후 3,000개 규모 + 런타임 조회가 필요해지면 Supabase word_bank 테이블로 이전)
 */

import type { CefrLevel, Language } from "@nativo/core";
import englishWords from "../data/seed-words/english.json";
import spanishWords from "../data/seed-words/spanish.json";
import japaneseWords from "../data/seed-words/japanese.json";

export interface SeedWord {
  word: string;
  meaning: string; // 한국어 뜻
  meaning_en?: string; // 영영 뜻 (영어 카드)
  pronunciation?: string;
  example_1?: string;
  part_of_speech?: string;
  difficulty?: CefrLevel;
}

export const SEED_WORDS: Record<Language, SeedWord[]> = {
  english: englishWords as SeedWord[],
  spanish: spanishWords as SeedWord[],
  japanese: japaneseWords as SeedWord[],
};
