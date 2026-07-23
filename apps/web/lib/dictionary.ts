/**
 * 단어 뜻 자동 보강 (사전 API).
 * 설계서: 영어 → Free Dictionary API, 일본어 → Jisho API, 스페인어 → OpenAI(키 필요).
 *
 * 서버에서만 호출(외부 API CORS 회피) — app/api/enrich 라우트 경유.
 */

import type { Language, TablesInsert } from "@nativo/core";
import { translateToKorean } from "./deepl";

/** 사전에서 채워줄 수 있는 카드 필드. */
export type EnrichedFields = Pick<
  TablesInsert<"flashcards">,
  "meaning" | "meaning_en" | "pronunciation" | "example_1" | "part_of_speech"
>;

export async function enrichWord(
  word: string,
  language: Language,
): Promise<Partial<EnrichedFields>> {
  try {
    if (language === "english") return await enrichEnglish(word);
    if (language === "japanese") return await enrichJapanese(word);
    return {}; // spanish: OpenAI 키 준비 시 추가
  } catch {
    return {}; // 보강 실패해도 단어 자체는 추가 가능
  }
}

/** enrichWordFull 결과: 보강 필드 + DeepL 한국어 뜻 사용 여부. */
export interface FullEnrichment {
  fields: Partial<EnrichedFields>;
  usedDeepL: boolean;
}

/**
 * 사전 API(발음·예문·품사·영영뜻)와 DeepL(한국어 뜻)을 병렬 조회해 하나로 합친다.
 *
 * - meaning(한국어 뜻): DeepL 우선, 없으면 사전 API 의 뜻(영어는 영영정의)로 폴백
 * - meaning_en / pronunciation / example_1 / part_of_speech: 사전 API 값 유지
 *
 * DeepL 키가 없으면 사전 API 결과만 돌려준다(usedDeepL=false).
 */
export async function enrichWordFull(
  word: string,
  language: Language,
): Promise<FullEnrichment> {
  const [fields, koMeaning] = await Promise.all([
    enrichWord(word, language),
    translateToKorean(word, language),
  ]);

  if (koMeaning) {
    return {
      fields: {
        ...fields,
        meaning: koMeaning, // 한국어 뜻으로 덮어씀
        meaning_en: fields.meaning_en ?? fields.meaning ?? null, // 사전 뜻은 영영으로 보존
      },
      usedDeepL: true,
    };
  }

  return { fields, usedDeepL: false };
}

/** 영어: Free Dictionary API (무료, 키 불필요) → 영영 정의. */
async function enrichEnglish(word: string): Promise<Partial<EnrichedFields>> {
  const res = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
    { signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) return {};
  const data = (await res.json()) as DictEntry[];
  const entry = data[0];
  if (!entry) return {};

  const phonetic = entry.phonetic ?? entry.phonetics?.find((p) => p.text)?.text;
  const meaning0 = entry.meanings?.[0];
  const def0 = meaning0?.definitions?.[0];

  return {
    meaning: def0?.definition, // 영영 정의를 뜻으로 (한국어 뜻은 미제공)
    meaning_en: def0?.definition,
    pronunciation: phonetic,
    example_1: def0?.example,
    part_of_speech: meaning0?.partOfSpeech,
  };
}

/** 일본어: Jisho API (무료) → 읽기 + 영어 의미. */
async function enrichJapanese(word: string): Promise<Partial<EnrichedFields>> {
  const res = await fetch(
    `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`,
    { signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) return {};
  const data = (await res.json()) as JishoResponse;
  const entry = data.data?.[0];
  if (!entry) return {};

  const reading = entry.japanese?.[0]?.reading;
  const sense0 = entry.senses?.[0];
  const defs = sense0?.english_definitions?.join(", ");

  return {
    meaning: defs,
    meaning_en: defs,
    pronunciation: reading,
    part_of_speech: sense0?.parts_of_speech?.[0],
  };
}

// --- 외부 API 응답 타입(필요한 필드만) ---
interface DictEntry {
  phonetic?: string;
  phonetics?: { text?: string }[];
  meanings?: {
    partOfSpeech?: string;
    definitions?: { definition?: string; example?: string }[];
  }[];
}

interface JishoResponse {
  data?: {
    japanese?: { word?: string; reading?: string }[];
    senses?: { english_definitions?: string[]; parts_of_speech?: string[] }[];
  }[];
}
